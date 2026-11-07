import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import ExamAttempt from "../models/ExamAttempt";
import Exam from "../models/Exam";
import Question from "../models/Question";
import User from "../models/User";
import { finalizeExpiredAttempts } from "../services/finalizeExpired";
import { buildRoster, AttemptLite } from "../services/examRoster";

const RESULTS_DELAY_MS = 60 * 60 * 1000; // 1 hour, applies to student, teacher, and admin alike

function resultsUnlockAt(exam: { endTime: Date }): Date {
  return new Date(new Date(exam.endTime).getTime() + RESULTS_DELAY_MS);
}

function isUnlocked(exam: { endTime: Date }): boolean {
  return Date.now() >= resultsUnlockAt(exam).getTime();
}

// Everyone who was meant to sit this exam: attempts plus class members who never started (score 0).
async function loadRoster(exam: any) {
  const attempts = await ExamAttempt.find({
    examId: exam._id,
    status: { $in: ["submitted", "auto-submitted", "flagged"] }
  }).populate("studentId", "name email");

  const students = await User.find({ schoolId: exam.schoolId, role: "student", classId: exam.classId }).select("name email");
  const questions = await Question.find({ _id: { $in: exam.questionIds } });
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

  const lite: AttemptLite[] = attempts
    .filter((a) => a.studentId)
    .map((a) => ({
      studentId: String((a.studentId as any)._id),
      studentName: (a.studentId as any).name,
      email: (a.studentId as any).email,
      score: a.score,
      status: a.status as AttemptLite["status"],
      submittedAt: a.submittedAt,
      needsGrading: a.needsGrading,
      flaggedEvents: a.flaggedEvents.map((e) => ({ type: e.type, timestamp: e.timestamp }))
    }));

  return { totalMarks, ...buildRoster(lite, students.map((u) => ({ id: String(u._id), name: u.name, email: u.email })), totalMarks) };
}

// Student: their own result for one exam.
export async function getMyResult(req: AuthedRequest, res: Response) {
  const exam = await Exam.findOne({ _id: req.params.examId, schoolId: req.user!.schoolId });
  if (!exam) return res.status(404).json({ error: "Exam not found" });

  if (!isUnlocked(exam)) {
    return res.status(403).json({
      error: "Results aren't available yet -- they unlock 1 hour after the exam ends.",
      unlockAt: resultsUnlockAt(exam)
    });
  }

  await finalizeExpiredAttempts({ examIds: [exam._id] });
  const attempt = await ExamAttempt.findOne({
    examId: req.params.examId,
    studentId: req.user!.userId
  });
  if (!attempt) {
    // They were in the exam's class but never started it: that is a 0, not a missing result.
    const me = await User.findById(req.user!.userId).select("classId");
    if (me?.classId && String(me.classId) === String(exam.classId)) {
      return res.json({ examId: exam._id, status: "absent", score: 0, needsGrading: false, submittedAt: null });
    }
    return res.status(404).json({ error: "You did not attempt this exam." });
  }
  if (attempt.status === "in-progress") {
    return res.status(400).json({ error: "Exam not yet submitted" });
  }


  res.json({
    examId: attempt.examId,
    status: attempt.status,
    score: attempt.score,
    needsGrading: attempt.needsGrading,
    submittedAt: attempt.submittedAt
  });
}

// Teacher/admin: every student's result for one exam, plus class average.
// Includes "flagged" attempts (ended early for integrity violations) --
// these were previously excluded here entirely, so a cheating student's
// result just silently vanished from the teacher's view.
export async function getExamResults(req: AuthedRequest, res: Response) {
  const exam = await Exam.findOne({ _id: req.params.examId, schoolId: req.user!.schoolId });
  if (!exam) return res.status(404).json({ error: "Exam not found" });

  if (!isUnlocked(exam)) {
    return res.status(403).json({
      error: "Results aren't available yet -- they unlock 1 hour after the exam ends.",
      unlockAt: resultsUnlockAt(exam)
    });
  }

  // Close out abandoned attempts first so no one's result is missing.
  await finalizeExpiredAttempts({ examIds: [exam._id] });
  const roster = await loadRoster(exam);

  res.json({
    examId: exam._id,
    examTitle: exam.title,
    totalMarks: roster.totalMarks,
    classAverage: roster.classAverage,           // everyone in the class, absentees counted as 0
    attemptedAverage: roster.attemptedAverage,   // only students who sat the exam
    classSize: roster.classSize,
    submittedCount: roster.submittedCount,
    absentCount: roster.absentCount,
    results: roster.rows
  });
}

// Teacher/admin only: CSV download of one exam's results -- same 1-hour gate,
// same status fix as above.
export async function exportExamResultsCsv(req: AuthedRequest, res: Response) {
  const exam = await Exam.findOne({ _id: req.params.examId, schoolId: req.user!.schoolId });
  if (!exam) return res.status(404).json({ error: "Exam not found" });

  if (!isUnlocked(exam)) {
    return res.status(403).json({
      error: "Results aren't available yet -- they unlock 1 hour after the exam ends.",
      unlockAt: resultsUnlockAt(exam)
    });
  }

  await finalizeExpiredAttempts({ examIds: [exam._id] });
  const roster = await loadRoster(exam);

  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [["Student Name", "Email", "Score", "Total Marks", "Status", "Flags", "Submitted At"].join(",")];

  for (const r of roster.rows) {
    lines.push(
      [
        escape(r.studentName),
        escape(r.email),
        r.score,
        r.totalMarks,
        r.status === "absent" ? "absent (did not attempt)" : r.status,
        r.flagCount,
        r.submittedAt ? new Date(r.submittedAt).toISOString() : ""
      ].join(",")
    );
  }

  const safeTitle = exam.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}_results.csv"`);
  res.send(lines.join("\n"));
}

// Teacher/admin: a student's results across all exams (report-card style).
// Each exam entry still respects its own 1-hour gate.
export async function getStudentSummary(req: AuthedRequest, res: Response) {
  const student = await User.findOne({ _id: req.params.studentId, schoolId: req.user!.schoolId });
  if (!student) return res.status(404).json({ error: "Student not found" });

  const attempts = await ExamAttempt.find({
    studentId: student._id,
    status: { $in: ["submitted", "auto-submitted", "flagged"] }
  }).populate("examId", "title subjectId endTime");

  const results = attempts
    .filter((a) => a.examId && isUnlocked(a.examId as any))
    .map((a) => ({
      examId: (a.examId as any)._id,
      examTitle: (a.examId as any).title,
      subjectId: (a.examId as any).subjectId,
      score: a.score ?? 0,
      submittedAt: a.submittedAt
    }));

  // Exams set for their class that are past the results gate and that they never started count as 0.
  const attemptedIds = new Set(attempts.map((a) => String((a.examId as any)?._id)));
  const classExams = student.classId
    ? await Exam.find({ schoolId: student.schoolId, classId: student.classId, status: { $ne: "draft" } }).select("title subjectId endTime")
    : [];
  for (const e of classExams) {
    if (attemptedIds.has(String(e._id)) || !isUnlocked(e)) continue;
    results.push({ examId: e._id as any, examTitle: e.title, subjectId: e.subjectId as any, score: 0, submittedAt: null as any, absent: true } as any);
  }

  res.json({ studentId: student._id, studentName: student.name, results });
}