import { Response } from "express";
import { isValidObjectId } from "mongoose";
import { AuthedRequest } from "../middleware/auth";
import Exam from "../models/Exam";
import User from "../models/User";
import Class from "../models/Class";
import Subject from "../models/Subject";
import School from "../models/School";
import Remark from "../models/Remark";
import { loadExamData } from "../services/analyticsData";
import { isUnlocked } from "../utils/resultsGate";
import { mean, summariseStudent, ExamPoint, MIN_CLASS_SAMPLE, PASS_MARK, GOOD_MARK } from "../services/analytics";
import { bandOf, parsePeriod, inPeriod } from "../services/reportCard";

const round1 = (n: number) => Math.round(n * 10) / 10;

// Builds report-card data for a class (or one student in it). Only RELEASED remarks appear:
// nothing a teacher or admin hasn't approved can reach a printed card.
async function buildCards(schoolId: string, classId: string, period: { from: Date | null; to: Date | null }, onlyStudentId?: string) {
  const [school, cls] = await Promise.all([
    School.findById(schoolId).select("name branding"),
    Class.findOne({ _id: classId, schoolId }).select("name")
  ]);
  const roster = (await User.find({ schoolId, role: "student", classId }).select("name"))
    .filter((s) => !onlyStudentId || String(s._id) === onlyStudentId);

  const exams = (await Exam.find({ schoolId, classId, status: { $ne: "draft" } }).sort({ startTime: 1 }))
    .filter((e) => isUnlocked(e) && inPeriod(e.startTime, period));

  const head = {
    school: { name: school?.name ?? "School", logoUrl: school?.branding?.logoUrl ?? null, primaryColor: school?.branding?.primaryColor ?? null },
    className: cls?.name ?? "Class",
    period: { from: period.from, to: period.to ? new Date(+period.to - 24 * 60 * 60 * 1000) : null },
    passMark: PASS_MARK, goodMark: GOOD_MARK
  };
  if (exams.length === 0) return { ...head, cards: [], examCount: 0, pending: { subjectRemarks: 0, overall: 0 } };

  const { byExam, attemptPct } = await loadExamData(exams);
  const subjects = await Subject.find({ _id: { $in: exams.map((e) => e.subjectId) } }).select("name");
  const subjectName = new Map(subjects.map((s) => [String(s._id), s.name]));
  const subjectIds = [...new Set(exams.map((e) => String(e.subjectId)))].sort((a, b) => (subjectName.get(a) ?? "").localeCompare(subjectName.get(b) ?? ""));

  // Released remarks: the latest per student (and subject).
  const released = await Remark.find({ schoolId, status: "released", studentId: { $in: roster.map((s) => s._id) } }).sort({ releasedAt: -1 });
  const remarkFor = (sid: string, kind: string, subjectId?: string) =>
    released.find((r) => String(r.studentId) === sid && r.kind === kind && (kind === "overall" || String(r.subjectId) === subjectId))?.text ?? null;

  const pointsFor = (sid: string, list: any[]): ExamPoint[] => list.map((e) => {
    const a = (byExam.get(String(e._id)) ?? []).find((x) => String(x.studentId) === sid);
    return a ? { pct: attemptPct(a, String(e._id)), sat: true } : { pct: null, sat: false };
  });
  // Class average only counts students who sat, and is hidden when too few did.
  const classAvgOf = (list: any[]) => {
    const avgs = list.map((e) => {
      const g = (byExam.get(String(e._id)) ?? []).map((a) => attemptPct(a, String(e._id))).filter((v): v is number => v !== null);
      return g.length >= MIN_CLASS_SAMPLE ? mean(g) : null;
    }).filter((v): v is number => v !== null);
    return avgs.length ? round1(mean(avgs)) : null;
  };
  const subjectClassAvg = new Map(subjectIds.map((sid) => [sid, classAvgOf(exams.filter((e) => String(e.subjectId) === sid))]));
  const overallClassAvg = classAvgOf(exams);

  let missingSubject = 0, missingOverall = 0;
  const cards = roster.map((st) => {
    const sid = String(st._id);
    const subs = subjectIds.map((subId) => {
      const list = exams.filter((e) => String(e.subjectId) === subId);
      const s = summariseStudent(pointsFor(sid, list));
      const remark = remarkFor(sid, "subject", subId);
      if (!remark) missingSubject++;
      return { subjectId: subId, subjectName: subjectName.get(subId) ?? "Subject", average: s.average, classAverage: subjectClassAvg.get(subId) ?? null, sat: s.sat, exams: s.exams, participation: s.participation, trend: s.trend, band: bandOf(s.average), remark };
    });
    const o = summariseStudent(pointsFor(sid, exams));
    const overallRemark = remarkFor(sid, "overall");
    if (!overallRemark) missingOverall++;
    return {
      student: { id: sid, name: st.name },
      subjects: subs,
      overall: { average: o.average, classAverage: overallClassAvg, sat: o.sat, exams: o.exams, participation: o.participation, trend: o.trend, band: bandOf(o.average), remark: overallRemark },
      enoughData: o.enoughData
    };
  }).sort((a, b) => a.student.name.localeCompare(b.student.name));

  return { ...head, cards, examCount: exams.length, pending: { subjectRemarks: missingSubject, overall: missingOverall } };
}

// Admin: every student's card for one class, for printing together.
export async function getClassReportCards(req: AuthedRequest, res: Response) {
  const { classId, from, to } = req.query as Record<string, string | undefined>;
  if (!classId || !isValidObjectId(classId)) return res.status(400).json({ error: "Choose a class." });
  const period = parsePeriod(from, to);
  if (period.error) return res.status(400).json({ error: period.error });
  if (!(await Class.exists({ _id: classId, schoolId: req.user!.schoolId }))) return res.status(404).json({ error: "Class not found." });
  res.json(await buildCards(req.user!.schoolId, classId, period));
}

// Student: my own card, same layout, my own data only.
export async function getMyReportCard(req: AuthedRequest, res: Response) {
  const me = await User.findById(req.user!.userId).select("classId");
  if (!me?.classId) return res.status(404).json({ error: "You are not in a class yet." });
  const period = parsePeriod(req.query.from, req.query.to);
  if (period.error) return res.status(400).json({ error: period.error });
  const data = await buildCards(req.user!.schoolId, String(me.classId), period, req.user!.userId);
  res.json({ ...data, card: data.cards[0] ?? null, cards: undefined, pending: undefined });
}
