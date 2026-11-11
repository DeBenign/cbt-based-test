import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import Exam from "../models/Exam";
import ExamAttempt from "../models/ExamAttempt";
import User from "../models/User";
import Class from "../models/Class";
import Subject from "../models/Subject";
import Remark from "../models/Remark";
import { loadExamData } from "../services/analyticsData";
import { isUnlocked } from "../utils/resultsGate";
import { mean, classTrend, MIN_EXAMS } from "../services/analytics";
import { gradingStats, buildSignals, PaperSample } from "../services/staffIndicators";

const round1 = (n: number) => Math.round(n * 10) / 10;
const DAY = 24 * 60 * 60 * 1000;

// Admin: indicators for every teacher. Teacher: only their own, so an appraisal is never a secret.
// Nothing here is a score or a ranking: teachers are listed alphabetically.
export async function getStaffIndicators(req: AuthedRequest, res: Response) {
  const schoolId = req.user!.schoolId;
  const days = Math.min(365, Math.max(14, Number(req.query.days) || 90));
  const since = new Date(Date.now() - days * DAY);

  const teachers = req.user!.role === "teacher"
    ? await User.find({ _id: req.user!.userId, schoolId }).select("name subjectIds")
    : await User.find({ schoolId, role: "teacher" }).select("name subjectIds");

  const [classes, subjects, students] = await Promise.all([
    Class.find({ schoolId }).select("name"), Subject.find({ schoolId }).select("name"), User.find({ schoolId, role: "student" }).select("classId")
  ]);
  const cn = new Map(classes.map((c) => [String(c._id), c.name]));
  const sn = new Map(subjects.map((s) => [String(s._id), s.name]));
  const classSize = (cid: string) => students.filter((s) => String(s.classId) === cid).length;

  const allExams = await Exam.find({ schoolId, status: { $ne: "draft" }, createdBy: { $in: teachers.map((t) => t._id) }, startTime: { $gte: since } }).sort({ startTime: 1 });
  const unlocked = allExams.filter((e) => isUnlocked(e));
  const { byExam, attemptPct } = unlocked.length ? await loadExamData(unlocked) : { byExam: new Map<string, any[]>(), attemptPct: () => null as number | null };

  // Papers that needed theory marking (waiting or done), for marking-speed figures.
  const papers = allExams.length
    ? await ExamAttempt.find({ examId: { $in: allExams.map((e) => e._id) }, status: { $in: ["submitted", "auto-submitted", "flagged"] } }).select("examId needsGrading submittedAt answers")
    : [];
  const examOwner = new Map(allExams.map((e) => [String(e._id), String(e.createdBy)]));

  const remarks = await Remark.find({ schoolId, kind: "subject" }).sort({ createdAt: -1 });

  const rows = teachers.map((t) => {
    const tid = String(t._id);
    const mine = allExams.filter((e) => String(e.createdBy) === tid);
    const mineUnlocked = unlocked.filter((e) => String(e.createdBy) === tid);

    // Marking speed, from this teacher's exams only.
    const samples: PaperSample[] = [];
    for (const a of papers) {
      if (examOwner.get(String(a.examId)) !== tid || !a.submittedAt) continue;
      const graded = a.answers.map((x: any) => x.gradedAt).filter(Boolean).map((d: Date) => +new Date(d));
      if (a.needsGrading) samples.push({ submittedAt: a.submittedAt, gradedAt: null });
      else if (graded.length) samples.push({ submittedAt: a.submittedAt, gradedAt: new Date(Math.max(...graded)) });
    }
    const grading = gradingStats(samples);

    // Share of the class who sat each of their exams.
    const parts = mineUnlocked.map((e) => {
      const size = classSize(String(e.classId));
      return size ? ((byExam.get(String(e._id)) ?? []).length / size) * 100 : null;
    }).filter((v): v is number => v !== null);
    const participation = parts.length ? Math.round(mean(parts)) : null;

    // Class results per class-and-subject, as context.
    const pairs = [...new Set(mineUnlocked.map((e) => `${e.classId}:${e.subjectId}`))];
    const classRows = pairs.map((p) => {
      const [cid, sid] = p.split(":");
      const ex = mineUnlocked.filter((e) => String(e.classId) === cid && String(e.subjectId) === sid);
      const avgs = ex.map((e) => {
        const g = (byExam.get(String(e._id)) ?? []).map((a) => attemptPct(a, String(e._id))).filter((v): v is number => v !== null);
        return g.length ? mean(g) : null;
      }).filter((v): v is number => v !== null);
      return { classId: cid, subjectId: sid, className: cn.get(cid) ?? "Class", subjectName: sn.get(sid) ?? "Subject", exams: ex.length, average: avgs.length ? round1(mean(avgs)) : null, trend: classTrend(avgs) };
    }).sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }) || a.subjectName.localeCompare(b.subjectName));

    // Remarks this teacher has released, out of the students in the classes they set exams for.
    const latest = new Map<string, any>();
    for (const r of remarks) {
      if (String(r.authorId) !== tid) continue;
      const k = `${r.studentId}:${r.subjectId}`;
      if (!latest.has(k)) latest.set(k, r);
    }
    const pairsSet = new Set(pairs);
    const released = [...latest.values()].filter((r) => r.status === "released" && pairsSet.has(`${r.classId}:${r.subjectId}`)).length;
    const remarkStudents = [...new Set(pairs.map((p) => p.split(":")[0]))].reduce((n, cid) => n + classSize(cid) * pairs.filter((p) => p.startsWith(cid)).length, 0);

    const hasSubjects = (t.subjectIds ?? []).length > 0;
    return {
      teacherId: tid, name: t.name,
      subjects: (t.subjectIds ?? []).map((s) => sn.get(String(s)) ?? "Subject").sort(),
      examsSet: mine.length, participation, participationExams: parts.length,
      grading, classes: classRows,
      remarks: { released, students: released > 0 || latest.size > 0 ? remarkStudents : 0 },
      enoughData: mine.length >= MIN_EXAMS,
      signals: buildSignals({ hasSubjects, periodDays: days, examsSet: mine.length, participation, participationExams: parts.length, grading, classes: classRows, remarks: { released, students: latest.size > 0 ? remarkStudents : 0 } })
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  res.json({
    days,
    note: "These are indicators, not scores. Class results depend on the class and the paper as well as the teacher, so use them alongside classroom observation.",
    teachers: rows
  });
}
