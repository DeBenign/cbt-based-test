import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import ExamAttempt from "../models/ExamAttempt";
import Exam from "../models/Exam";
import Question from "../models/Question";
import User from "../models/User";

const RESULTS_DELAY_MS = 60 * 60 * 1000; // 1 hour, applies to student, teacher, and admin alike

function resultsUnlockAt(exam: { endTime: Date }): Date {
  return new Date(new Date(exam.endTime).getTime() + RESULTS_DELAY_MS);
}

function isUnlocked(exam: { endTime: Date }): boolean {
  return Date.now() >= resultsUnlockAt(exam).getTime();
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

  const attempt = await ExamAttempt.findOne({
    examId: req.params.examId,
    studentId: req.user!.userId
  });
  if (!attempt) return res.status(404).json({ error: "You did not attempt this exam." });
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

  const attempts = await ExamAttempt.find({
    examId: exam._id,
    status: { $in: ["submitted", "auto-submitted", "flagged"] }
  }).populate("studentId", "name email");

  const questions = await Question.find({ _id: { $in: exam.questionIds } });
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

  const rows = attempts.map((a) => ({
    studentId: (a.studentId as any)._id,
    studentName: (a.studentId as any).name,
    score: a.score ?? 0,
    totalMarks,
    status: a.status,
    submittedAt: a.submittedAt,
    needsGrading: a.needsGrading,
    flagCount: a.flaggedEvents.length,
    flaggedEvents: a.flaggedEvents.map((e) => ({ type: e.type, timestamp: e.timestamp }))
  }));

  const average = rows.length > 0 ? rows.reduce((sum, r) => sum + r.score, 0) / rows.length : 0;

  res.json({
    examId: exam._id,
    examTitle: exam.title,
    totalMarks,
    classAverage: Math.round(average * 100) / 100,
    submittedCount: rows.length,
    results: rows.sort((a, b) => b.score - a.score)
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

  const attempts = await ExamAttempt.find({
    examId: exam._id,
    status: { $in: ["submitted", "auto-submitted", "flagged"] }
  }).populate("studentId", "name email");

  const questions = await Question.find({ _id: { $in: exam.questionIds } });
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [["Student Name", "Email", "Score", "Total Marks", "Status", "Flags", "Submitted At"].join(",")];

  for (const a of attempts) {
    const student: any = a.studentId;
    lines.push(
      [
        escape(student?.name || ""),
        escape(student?.email || ""),
        a.score ?? 0,
        totalMarks,
        a.status,
        a.flaggedEvents.length,
        a.submittedAt ? new Date(a.submittedAt).toISOString() : ""
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

  res.json({ studentId: student._id, studentName: student.name, results });
}