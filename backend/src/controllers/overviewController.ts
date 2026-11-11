import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import Exam from "../models/Exam";
import User from "../models/User";
import Class from "../models/Class";
import Subject from "../models/Subject";
import { loadExamData } from "../services/analyticsData";
import { isUnlocked } from "../utils/resultsGate";
import { mean, summariseStudent, classTrend, ExamPoint, MIN_EXAMS, PASS_MARK } from "../services/analytics";

const round1 = (n: number) => Math.round(n * 10) / 10;

// Admin: the whole school at a glance. Every class and subject, and the students worth a conversation,
// either to encourage or to support. Read-only; the detail lives on each class's analytics page.
export async function getSchoolOverview(req: AuthedRequest, res: Response) {
  const schoolId = req.user!.schoolId;
  const [classes, subjects, students] = await Promise.all([
    Class.find({ schoolId }).select("name"),
    Subject.find({ schoolId }).select("name"),
    User.find({ schoolId, role: "student" }).select("name classId")
  ]);
  const className = new Map(classes.map((c) => [String(c._id), c.name]));
  const subjectName = new Map(subjects.map((s) => [String(s._id), s.name]));

  const exams = (await Exam.find({ schoolId, status: { $ne: "draft" } }).sort({ startTime: 1 })).filter((e) => isUnlocked(e));
  if (exams.length === 0) {
    return res.json({ summary: null, classes: [], subjects: [], attention: [], doingWell: [], improving: [], passMark: PASS_MARK, message: "No finished exams yet. The overview fills in one hour after your first exam ends." });
  }

  const { byExam, attemptPct } = await loadExamData(exams);

  const studentsOf = (classId: string) => students.filter((s) => String(s.classId) === classId);
  const examAverage = (e: any) => {
    const graded = (byExam.get(String(e._id)) ?? []).map((a) => attemptPct(a, String(e._id))).filter((v): v is number => v !== null);
    return graded.length ? mean(graded) : null;
  };
  const examParticipation = (e: any) => {
    const size = studentsOf(String(e.classId)).length;
    return size ? ((byExam.get(String(e._id)) ?? []).length / size) * 100 : null;
  };

  // ---- per class, and the students in it
  type Person = { studentId: string; name: string; className: string; average: number | null; participation: number; reasons: string[]; weakSubjects: string[]; flag: string | null };
  const people: Person[] = [];
  const classRows = [...new Set(exams.map((e) => String(e.classId)))].map((cid) => {
    const cExams = exams.filter((e) => String(e.classId) === cid);
    const roster = studentsOf(cid);
    const avgs = cExams.map(examAverage).filter((v): v is number => v !== null);
    const parts = cExams.map(examParticipation).filter((v): v is number => v !== null);

    const pointsFor = (sid: string, list: any[]): ExamPoint[] => list.map((e) => {
      const a = (byExam.get(String(e._id)) ?? []).find((x) => String(x.studentId) === sid);
      return a ? { pct: attemptPct(a, String(e._id)), sat: true } : { pct: null, sat: false };
    });

    for (const st of roster) {
      const overall = summariseStudent(pointsFor(String(st._id), cExams));
      // Subjects this student is clearly below the pass mark in, so the list says where to help.
      const weakSubjects = [...new Set(cExams.map((e) => String(e.subjectId)))].filter((sid) => {
        const s = summariseStudent(pointsFor(String(st._id), cExams.filter((e) => String(e.subjectId) === sid)));
        return s.enoughData && s.average !== null && s.average < PASS_MARK;
      }).map((sid) => subjectName.get(sid) ?? "Subject");
      people.push({
        studentId: String(st._id), name: st.name, className: className.get(cid) ?? "Class",
        average: overall.average, participation: overall.participation, reasons: overall.reasons, weakSubjects, flag: overall.flag
      });
    }
    const flagged = (f: string) => people.filter((p) => p.className === (className.get(cid) ?? "Class") && p.flag === f).length;
    return {
      classId: cid, className: className.get(cid) ?? "Class", students: roster.length, exams: cExams.length,
      average: avgs.length ? round1(mean(avgs)) : null, participation: parts.length ? Math.round(mean(parts)) : 0,
      trend: classTrend(cExams.map(examAverage).filter((v): v is number => v !== null)),
      attention: flagged("attention"), doingWell: flagged("doing_well")
    };
  }).sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }));

  // ---- per subject, across every class that sits it
  const subjectRows = [...new Set(exams.map((e) => String(e.subjectId)))].map((sid) => {
    const sExams = exams.filter((e) => String(e.subjectId) === sid);
    const avgs = sExams.map(examAverage).filter((v): v is number => v !== null);
    const parts = sExams.map(examParticipation).filter((v): v is number => v !== null);
    return {
      subjectId: sid, subjectName: subjectName.get(sid) ?? "Subject", exams: sExams.length,
      average: avgs.length ? round1(mean(avgs)) : null, participation: parts.length ? Math.round(mean(parts)) : 0, trend: classTrend(avgs)
    };
  }).sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const allAvgs = exams.map(examAverage).filter((v): v is number => v !== null);
  const allParts = exams.map(examParticipation).filter((v): v is number => v !== null);
  const pick = (f: string) => people.filter((p) => p.flag === f);
  const byAvgAsc = (a: Person, b: Person) => (a.average ?? -1) - (b.average ?? -1) || a.participation - b.participation;

  res.json({
    passMark: PASS_MARK, minExams: MIN_EXAMS,
    summary: {
      students: students.length, classes: classRows.length, exams: exams.length,
      schoolAverage: allAvgs.length ? round1(mean(allAvgs)) : null, participation: allParts.length ? Math.round(mean(allParts)) : 0,
      attention: pick("attention").length, doingWell: pick("doing_well").length, improving: pick("improving").length,
      enoughData: exams.length >= MIN_EXAMS && students.length >= 8
    },
    classes: classRows,
    subjects: subjectRows,
    attention: pick("attention").sort(byAvgAsc).slice(0, 50),
    doingWell: pick("doing_well").sort((a, b) => (b.average ?? 0) - (a.average ?? 0)).slice(0, 50),
    improving: pick("improving").sort((a, b) => (b.average ?? 0) - (a.average ?? 0)).slice(0, 50)
  });
}
