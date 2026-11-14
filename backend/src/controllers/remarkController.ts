import { Response } from "express";
import { isValidObjectId } from "mongoose";
import { AuthedRequest } from "../middleware/auth";
import Exam from "../models/Exam";
import User from "../models/User";
import Class from "../models/Class";
import Subject from "../models/Subject";
import Remark from "../models/Remark";
import { loadExamData } from "../services/analyticsData";
import { loadTeacherScope, denyReason } from "../utils/teacherScope";
import { isUnlocked } from "../utils/resultsGate";
import { mean, summariseStudent, topicAccuracy, ExamPoint } from "../services/analytics";
import { buildSubjectRemark, buildOverallRemark, RemarkFacts } from "../services/remarkText";
import { topicTallies } from "../services/analyticsData";

const round1 = (n: number) => Math.round(n * 10) / 10;
const firstName = (full: string) => full.trim().split(/\s+/)[0] || full;
const MAX_TEXT = 1500;

// Subject teachers only handle remarks for their own subjects AND classes.
async function teacherScopeOf(userId: string) {
  return loadTeacherScope(userId);
}

// Subject teachers write subject remarks; the school admin writes the overall remark. Nobody writes the other's.
function scopeOf(req: AuthedRequest, subjectId?: string): { kind: "subject" | "overall"; error?: string } {
  if (req.user!.role === "admin") return subjectId ? { kind: "overall", error: "The overall remark is not tied to one subject." } : { kind: "overall" };
  return subjectId ? { kind: "subject" } : { kind: "subject", error: "Choose a subject." };
}

// Latest review per student (and subject, for subject remarks).
function latestPerStudent(reviews: any[]) {
  const latest = new Map<string, any>();
  for (const r of [...reviews].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))) {
    const key = String(r.studentId);
    if (!latest.has(key)) latest.set(key, r);
  }
  return latest;
}

// Work out the facts for every student in a class, for one subject or (no subject) across all of them.
async function factsForClass(schoolId: string, classId: string, subjectId?: string) {
  const exams = (await Exam.find({ schoolId, classId, ...(subjectId ? { subjectId } : {}), status: { $ne: "draft" } }).sort({ startTime: 1 })).filter((e) => isUnlocked(e));
  const students = await User.find({ schoolId, role: "student", classId }).select("name");
  if (exams.length === 0) return { exams, students, facts: new Map<string, RemarkFacts>() };

  const { byExam, attemptPct, tally } = await loadExamData(exams);
  const subjects = await Subject.find({ _id: { $in: exams.map((e) => e.subjectId) } }).select("name");
  const subjectName = new Map(subjects.map((s) => [String(s._id), s.name]));

  const pointsFor = (sid: string, list: any[]): ExamPoint[] => list.map((e) => {
    const a = (byExam.get(String(e._id)) ?? []).find((x) => String(x.studentId) === sid);
    return a ? { pct: attemptPct(a, String(e._id)), sat: true } : { pct: null, sat: false };
  });
  // Class average per exam only counts students who sat it; hidden when too few sat (same rule as the student's own chart).
  const classAvgs = exams.map((e) => {
    const g = (byExam.get(String(e._id)) ?? []).map((a) => attemptPct(a, String(e._id))).filter((v): v is number => v !== null);
    return g.length >= 3 ? mean(g) : null;
  }).filter((v): v is number => v !== null);
  const classAverage = classAvgs.length ? round1(mean(classAvgs)) : null;

  const facts = new Map<string, RemarkFacts>();
  for (const st of students) {
    const sid = String(st._id);
    const s = summariseStudent(pointsFor(sid, exams));
    const topics = topicAccuracy(topicTallies(tally(exams, (a) => String(a.studentId) === sid)));
    const base: RemarkFacts = {
      average: s.average, classAverage, participation: s.participation, exams: s.exams, sat: s.sat, trend: s.trend, flag: s.flag, enoughData: s.enoughData,
      weakTopics: topics.filter((t) => t.percentCorrect < 60).slice(0, 2).map((t) => t.topic),
      strongTopics: topics.filter((t) => t.percentCorrect >= 75).slice(-2).map((t) => t.topic)
    };
    if (!subjectId) {
      const per = [...new Set(exams.map((e) => String(e.subjectId)))].map((x) => ({ name: subjectName.get(x) ?? "Subject", s: summariseStudent(pointsFor(sid, exams.filter((e) => String(e.subjectId) === x))) }))
        .filter((x) => x.s.average !== null).sort((a, b) => (b.s.average as number) - (a.s.average as number));
      base.strongestSubject = per.length >= 2 ? per[0].name : null;
      base.weakestSubject = per.length >= 2 ? per[per.length - 1].name : null;
    }
    facts.set(sid, base);
  }
  return { exams, students, facts, subjectName: (subjectId && subjects[0]?.name) || undefined };
}

async function authorise(req: AuthedRequest, res: Response, classId?: string, subjectId?: string) {
  if (!classId || !isValidObjectId(classId) || (subjectId && !isValidObjectId(subjectId))) { res.status(400).json({ error: "Choose a class (and a subject, for teachers)." }); return null; }
  const scope = scopeOf(req, subjectId);
  if (scope.error) { res.status(400).json({ error: scope.error }); return null; }
  if (scope.kind === "subject") {
    const denied = denyReason(await teacherScopeOf(req.user!.userId), subjectId, classId);
    if (denied) { res.status(403).json({ error: denied }); return null; }
  }
  const cls = await Class.findOne({ _id: classId, schoolId: req.user!.schoolId }).select("name");
  if (!cls) { res.status(404).json({ error: "Class not found." }); return null; }
  if (subjectId && !(await Subject.findOne({ _id: subjectId, schoolId: req.user!.schoolId }).select("name"))) { res.status(404).json({ error: "Subject not found." }); return null; }
  return scope;
}

const baseFilter = (req: AuthedRequest, kind: string, classId: string, subjectId?: string) => ({
  schoolId: req.user!.schoolId, kind, classId, ...(subjectId ? { subjectId } : {})
});

// ---- teacher / admin: the class list with each student's latest remark ---------------------------
export async function listRemarks(req: AuthedRequest, res: Response) {
  const { classId, subjectId } = req.query as { classId?: string; subjectId?: string };
  const scope = await authorise(req, res, classId, subjectId);
  if (!scope) return;

  const students = await User.find({ schoolId: req.user!.schoolId, role: "student", classId }).select("name");
  const reviews = await Remark.find(baseFilter(req, scope.kind, classId!, subjectId)).sort({ createdAt: -1 });
  const latest = latestPerStudent(reviews);
  res.json({
    kind: scope.kind,
    students: students.map((s) => {
      const r = latest.get(String(s._id));
      return {
        studentId: String(s._id), name: s.name,
        review: r ? { id: String(r._id), status: r.status, text: r.text, edited: r.edited, createdAt: r.createdAt, flag: (r.facts as any)?.flag ?? null, enoughData: !!(r.facts as any)?.enoughData } : null
      };
    }).sort((a, b) => a.name.localeCompare(b.name))
  });
}

// ---- create or refresh drafts for the whole class ----------------------------------------------------
export async function generateRemarks(req: AuthedRequest, res: Response) {
  const { classId, subjectId } = req.body as { classId?: string; subjectId?: string };
  const scope = await authorise(req, res, classId, subjectId);
  if (!scope) return;

  const { exams, students, facts, subjectName } = await factsForClass(req.user!.schoolId, classId!, subjectId);
  if (exams.length === 0) return res.status(400).json({ error: "There are no finished exams for this class yet, so there is nothing to base remarks on." });

  const existing = latestPerStudent(await Remark.find(baseFilter(req, scope.kind, classId!, subjectId)).sort({ createdAt: -1 }));
  let created = 0, refreshed = 0, kept = 0;

  for (const st of students) {
    const f = facts.get(String(st._id))!;
    const text = scope.kind === "subject" ? buildSubjectRemark(f, subjectName || "this subject", firstName(st.name)) : buildOverallRemark(f, firstName(st.name));
    const cur = existing.get(String(st._id));

    if (cur && cur.status === "draft") {
      // Refresh the numbers and the system's wording; never overwrite words a person has written.
      cur.facts = f as any; cur.draftText = text;
      if (!cur.edited) cur.text = text; else kept++;
      await cur.save();
      refreshed++;
    } else {
      // No remark yet, or the last one is already released: start a fresh draft (the released one stays visible until this is released).
      await Remark.create({
        schoolId: req.user!.schoolId, kind: scope.kind, studentId: st._id, classId, ...(subjectId ? { subjectId } : {}),
        authorId: req.user!.userId, facts: f, draftText: text, text, edited: false, status: "draft"
      });
      created++;
    }
  }
  res.json({ created, refreshed, keptYourEdits: kept });
}

// ---- edit a draft ----------------------------------------------------------------------------------------
export async function editRemark(req: AuthedRequest, res: Response) {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) return res.status(400).json({ error: "The remark can't be empty." });
  if (text.length > MAX_TEXT) return res.status(400).json({ error: `Keep the remark under ${MAX_TEXT} characters.` });

  const review = await Remark.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!review || !(await mayTouch(req, review))) return res.status(404).json({ error: "Remark not found." });
  if (review.status === "released") return res.status(400).json({ error: "Withdraw this remark before editing it." });

  review.text = text;
  review.edited = text !== review.draftText;
  await review.save();
  res.json({ id: String(review._id), edited: review.edited });
}

async function mayTouch(req: AuthedRequest, review: any): Promise<boolean> {
  if (req.user!.role === "admin") return review.kind === "overall";
  return review.kind === "subject" && !!review.subjectId && !denyReason(await teacherScopeOf(req.user!.userId), review.subjectId, review.classId);
}

// ---- release (or withdraw) remarks so students can (or can no longer) see them -----------------------------
export async function releaseRemarks(req: AuthedRequest, res: Response) {
  const { ids, release } = req.body as { ids?: string[]; release?: boolean };
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(isValidObjectId)) return res.status(400).json({ error: "No remarks selected." });

  const filter: Record<string, unknown> = { _id: { $in: ids }, schoolId: req.user!.schoolId };
  if (req.user!.role === "admin") filter.kind = "overall";
  else {
    const mine = await teacherScopeOf(req.user!.userId);
    filter.kind = "subject";
    filter.subjectId = { $in: mine.subjectIds };
    filter.classId = { $in: mine.classIds };
  }

  const update = release === false ? { $set: { status: "draft" }, $unset: { releasedAt: 1 } } : { $set: { status: "released", releasedAt: new Date() } };
  const result = await Remark.updateMany(filter, update);
  res.json({ updated: result.modifiedCount ?? 0 });
}

// ---- student: remarks released for me -----------------------------------------------------------------------
export async function getMyRemarks(req: AuthedRequest, res: Response) {
  const mine = await Remark.find({ schoolId: req.user!.schoolId, studentId: req.user!.userId, status: "released" }).sort({ releasedAt: -1 });
  const seen = new Set<string>();
  const latest = mine.filter((r) => {
    const key = `${r.kind}:${r.subjectId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const subjects = await Subject.find({ _id: { $in: latest.map((r) => r.subjectId).filter(Boolean) } }).select("name");
  const sn = new Map(subjects.map((s) => [String(s._id), s.name]));
  res.json(latest.map((r) => ({ kind: r.kind, subjectName: r.subjectId ? sn.get(String(r.subjectId)) ?? "Subject" : null, text: r.text, releasedAt: r.releasedAt })));
}
