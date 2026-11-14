import { Response } from "express";
import { isValidObjectId } from "mongoose";
import { AuthedRequest } from "../middleware/auth";
import { loadTeacherScope, denyReason } from "../utils/teacherScope";
import Exam from "../models/Exam";
import User from "../models/User";
import Class from "../models/Class";
import Subject from "../models/Subject";
import { loadExamData, topicTallies } from "../services/analyticsData";
import { isUnlocked } from "../utils/resultsGate";
import {
  pct, mean, summariseStudent, histogram, mostMissed, topicAccuracy, classTrend,
  ExamPoint, MIN_EXAMS, MIN_CLASS_SAMPLE, PASS_MARK, GOOD_MARK
} from "../services/analytics";

const round1 = (n: number) => Math.round(n * 10) / 10;

// ---- student: my own progress ---------------------------------------------------------
export async function getMyAnalytics(req: AuthedRequest, res: Response) {
  const me = await User.findById(req.user!.userId).select("name classId schoolId");
  if (!me) return res.status(404).json({ error: "User not found" });
  const empty = { student: { name: me.name }, overall: null, subjects: [], topics: { weakest: [], strongest: [] } };
  if (!me.classId) return res.json({ ...empty, message: "You are not in a class yet." });

  const exams = (await Exam.find({ schoolId: me.schoolId, classId: me.classId, status: { $ne: "draft" } }).sort({ startTime: 1 }))
    .filter((e) => isUnlocked(e));
  if (exams.length === 0) return res.json({ ...empty, message: "No results yet. Your progress appears here after your first exam." });

  const { byExam, attemptPct, tally } = await loadExamData(exams);
  const subjects = await Subject.find({ _id: { $in: exams.map((e) => e.subjectId) } }).select("name");
  const subjectName = new Map(subjects.map((s) => [String(s._id), s.name]));

  const rowFor = (e: any) => {
    const id = String(e._id);
    const all = byExam.get(id) ?? [];
    const mine = all.find((a) => String(a.studentId) === String(me._id));
    // Class average only when enough classmates sat it, so a student can't work out one other person's score.
    const graded = all.map((a) => attemptPct(a, id)).filter((v): v is number => v !== null);
    const classAvg = graded.length >= MIN_CLASS_SAMPLE ? round1(mean(graded)) : null;
    const myPct = mine ? attemptPct(mine, id) : null;
    return {
      examId: id, title: e.title, date: e.startTime, subjectId: String(e.subjectId),
      pct: mine ? myPct : 0, sat: !!mine, absent: !mine, pending: !!mine && myPct === null, classAvg
    };
  };
  const rows = exams.map(rowFor);
  const toPoint = (r: ReturnType<typeof rowFor>): ExamPoint => ({ pct: r.sat ? r.pct : null, sat: r.sat });

  const bySubject = new Map<string, ReturnType<typeof rowFor>[]>();
  for (const r of rows) bySubject.set(r.subjectId, [...(bySubject.get(r.subjectId) ?? []), r]);

  const subjectViews = [...bySubject.entries()].map(([sid, rs]) => {
    const s = summariseStudent(rs.map(toPoint));
    const classAvgs = rs.map((r) => r.classAvg).filter((v): v is number => v !== null);
    return {
      subjectId: sid, subjectName: subjectName.get(sid) ?? "Subject", series: rs,
      average: s.average, averageWithAbsent: s.averageWithAbsent, classAverage: classAvgs.length ? round1(mean(classAvgs)) : null,
      trend: s.trend, exams: s.exams, sat: s.sat, participation: s.participation
    };
  }).sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const overall = summariseStudent(rows.map(toPoint));
  const allClassAvgs = rows.map((r) => r.classAvg).filter((v): v is number => v !== null);
  const ranked = subjectViews.filter((s) => s.average !== null).sort((a, b) => (b.average as number) - (a.average as number));

  const topics = topicAccuracy(topicTallies(tally(exams, (a) => String(a.studentId) === String(me._id))));
  const weakest = topics.slice(0, 5);
  const strongest = topics.slice(-5).reverse().filter((t) => !weakest.includes(t));

  res.json({
    student: { name: me.name },
    overall: {
      average: overall.average, averageWithAbsent: overall.averageWithAbsent, classAverage: allClassAvgs.length ? round1(mean(allClassAvgs)) : null,
      exams: overall.exams, sat: overall.sat, participation: overall.participation, trend: overall.trend, passMark: PASS_MARK, goodMark: GOOD_MARK,
      strongestSubject: ranked.length >= 2 ? ranked[0].subjectName : null,
      weakestSubject: ranked.length >= 2 ? ranked[ranked.length - 1].subjectName : null
    },
    subjects: subjectViews,
    topics: { weakest, strongest }
  });
}

// ---- teacher / admin: pick a class and subject ---------------------------------------

export async function listAnalyticsOptions(req: AuthedRequest, res: Response) {
  const filter: Record<string, unknown> = { schoolId: req.user!.schoolId, status: { $ne: "draft" } };
  if (req.user!.role === "teacher") {
    const scope = await loadTeacherScope(req.user!.userId);
    filter.subjectId = { $in: scope.subjectIds };
    filter.classId = { $in: scope.classIds };
  }

  const exams = (await Exam.find(filter).select("classId subjectId endTime")).filter((e) => isUnlocked(e));
  const counts = new Map<string, { classId: string; subjectId: string; exams: number }>();
  for (const e of exams) {
    const k = `${e.classId}:${e.subjectId}`;
    const cur = counts.get(k) ?? { classId: String(e.classId), subjectId: String(e.subjectId), exams: 0 };
    cur.exams++;
    counts.set(k, cur);
  }
  const [classes, subjects] = await Promise.all([
    Class.find({ _id: { $in: [...counts.values()].map((c) => c.classId) } }).select("name"),
    Subject.find({ _id: { $in: [...counts.values()].map((c) => c.subjectId) } }).select("name")
  ]);
  const cn = new Map(classes.map((c) => [String(c._id), c.name]));
  const sn = new Map(subjects.map((s) => [String(s._id), s.name]));

  res.json([...counts.values()]
    .map((c) => ({ ...c, className: cn.get(c.classId) ?? "Class", subjectName: sn.get(c.subjectId) ?? "Subject" }))
    .sort((a, b) => a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName)));
}

// ---- teacher / admin: one class in one subject ----------------------------------------
export async function getClassAnalytics(req: AuthedRequest, res: Response) {
  const { classId, subjectId } = req.query as { classId?: string; subjectId?: string };
  if (!classId || !subjectId || !isValidObjectId(classId) || !isValidObjectId(subjectId)) {
    return res.status(400).json({ error: "Choose a class and a subject." });
  }
  if (req.user!.role === "teacher") {
    const denied = denyReason(await loadTeacherScope(req.user!.userId), subjectId, classId);
    if (denied) return res.status(403).json({ error: denied });
  }
  const [cls, subject] = await Promise.all([
    Class.findOne({ _id: classId, schoolId: req.user!.schoolId }).select("name"),
    Subject.findOne({ _id: subjectId, schoolId: req.user!.schoolId }).select("name")
  ]);
  if (!cls || !subject) return res.status(404).json({ error: "Class or subject not found." });

  const exams = (await Exam.find({ schoolId: req.user!.schoolId, classId, subjectId, status: { $ne: "draft" } }).sort({ startTime: 1 }))
    .filter((e) => isUnlocked(e));
  const students = await User.find({ schoolId: req.user!.schoolId, role: "student", classId }).select("name");

  const base = { className: cls.name, subjectName: subject.name, passMark: PASS_MARK, goodMark: GOOD_MARK, minExams: MIN_EXAMS };
  if (exams.length === 0) return res.json({ ...base, summary: null, exams: [], students: [], distribution: histogram([]), mostMissed: [], topics: [], message: "No finished exams for this class and subject yet." });

  const { byExam, attemptPct, tally } = await loadExamData(exams);

  const examRows = exams.map((e) => {
    const id = String(e._id);
    const all = byExam.get(id) ?? [];
    const graded = all.map((a) => attemptPct(a, id)).filter((v): v is number => v !== null);
    return {
      examId: id, title: e.title, date: e.startTime,
      average: graded.length ? round1(mean(graded)) : null,
      sat: all.length, classSize: students.length, absent: Math.max(0, students.length - all.length),
      participation: students.length ? Math.round((all.length / students.length) * 100) : 0,
      pendingGrading: all.filter((a) => a.needsGrading).length
    };
  });

  const studentRows = students.map((s) => {
    const points: ExamPoint[] = exams.map((e) => {
      const id = String(e._id);
      const a = (byExam.get(id) ?? []).find((x) => String(x.studentId) === String(s._id));
      return a ? { pct: attemptPct(a, id), sat: true } : { pct: null, sat: false };
    });
    return { studentId: String(s._id), name: s.name, series: points.map((p) => (p.sat ? p.pct : 0)), ...summariseStudent(points) };
  }).sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || a.name.localeCompare(b.name));

  const examAverages = examRows.map((r) => r.average).filter((v): v is number => v !== null);
  const qTally = tally(exams);
  const flagCount = (f: string) => studentRows.filter((s) => s.flag === f).length;

  res.json({
    ...base,
    summary: {
      exams: exams.length, students: students.length,
      classAverage: examAverages.length ? round1(mean(examAverages)) : null,
      participation: examRows.length ? Math.round(mean(examRows.map((r) => r.participation))) : 0,
      trend: classTrend(examAverages),
      attention: flagCount("attention"), doingWell: flagCount("doing_well"), improving: flagCount("improving"),
      enoughData: exams.length >= MIN_EXAMS && students.length >= 8
    },
    exams: examRows,
    students: studentRows,
    distribution: histogram(studentRows.map((s) => s.average).filter((v): v is number => v !== null)),
    mostMissed: mostMissed(qTally),
    topics: topicAccuracy(topicTallies(qTally))
  });
}
