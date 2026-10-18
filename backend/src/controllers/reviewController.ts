import { Response } from "express";
import mongoose from "mongoose";
import { AuthedRequest } from "../middleware/auth";
import Exam from "../models/Exam";
import ExamAttempt from "../models/ExamAttempt";
import Question from "../models/Question";
import User from "../models/User";
import { gradeAttempt } from "../services/gradeAttempt";
import { logActivity } from "../utils/activity";

// ---------- helpers ----------

// An attempt belongs to a school through its exam (attempts don't carry schoolId).
async function loadAttempt(req: AuthedRequest, res: Response) {
  const attempt = await ExamAttempt.findById(req.params.id);
  if (!attempt) { res.status(404).json({ error: "Attempt not found" }); return null; }
  const exam = await Exam.findOne({ _id: attempt.examId, schoolId: req.user!.schoolId });
  if (!exam) { res.status(404).json({ error: "Attempt not found" }); return null; }
  return { attempt, exam };
}

function requireReason(req: AuthedRequest, res: Response): string | null {
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 5) {
    res.status(400).json({ error: "Give a reason (at least a few words). It's recorded in the activity log." });
    return null;
  }
  return reason;
}

const snapshot = (a: any) => ({
  status: a.status,
  score: a.score ?? null,
  answered: a.answers.length,
  flags: a.flaggedEvents.length,
  serverEndTime: a.serverEndTime
});

// ---------- read ----------

export async function listAttempts(req: AuthedRequest, res: Response) {
  const { examId, studentId, status, flagged } = req.query;
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 30));

  const exams = await Exam.find({ schoolId: req.user!.schoolId, ...(examId ? { _id: examId } : {}) }).select("title");
  const examTitle = new Map(exams.map((e) => [e._id.toString(), e.title]));

  const filter: Record<string, any> = { examId: { $in: exams.map((e) => e._id) } };
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  if (flagged === "true") filter["flaggedEvents.0"] = { $exists: true };

  const [attempts, total] = await Promise.all([
    ExamAttempt.find(filter).sort({ startedAt: -1 }).skip((page - 1) * limit).limit(limit).populate("studentId", "name username"),
    ExamAttempt.countDocuments(filter)
  ]);

  res.json({
    items: attempts.map((a) => ({
      _id: a._id,
      examId: a.examId,
      examTitle: examTitle.get(a.examId.toString()),
      student: { _id: (a.studentId as any)?._id, name: (a.studentId as any)?.name || "Deleted user", username: (a.studentId as any)?.username },
      status: a.status,
      score: a.score ?? null,
      needsGrading: a.needsGrading,
      flagCount: a.flaggedEvents.length,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt || null
    })),
    total,
    page,
    pages: Math.ceil(total / limit)
  });
}

// Everything about one attempt: what each question was, what the student
// answered, what was correct, and every integrity event.
export async function getAttemptDetail(req: AuthedRequest, res: Response) {
  const loaded = await loadAttempt(req, res);
  if (!loaded) return;
  const { attempt, exam } = loaded;

  const [questions, student] = await Promise.all([
    Question.find({ _id: { $in: attempt.questionOrder } }),
    User.findById(attempt.studentId).select("name username email")
  ]);
  const qById = new Map(questions.map((q) => [q._id.toString(), q]));
  const aById = new Map(attempt.answers.map((a) => [a.questionId.toString(), a]));

  res.json({
    attempt: {
      _id: attempt._id,
      status: attempt.status,
      score: attempt.score ?? null,
      needsGrading: attempt.needsGrading,
      startedAt: attempt.startedAt,
      serverEndTime: attempt.serverEndTime,
      submittedAt: attempt.submittedAt || null,
      flaggedEvents: attempt.flaggedEvents
    },
    exam: { _id: exam._id, title: exam.title, status: exam.status, duration: exam.duration, lockdownRequired: exam.lockdownRequired },
    student: student ? { _id: student._id, name: student.name, username: student.username } : null,
    maxScore: questions.reduce((n, q) => n + q.marks, 0),
    questions: attempt.questionOrder.map((id) => {
      const q = qById.get(id.toString());
      const a = aById.get(id.toString());
      if (!q) return { questionId: id, missing: true };
      const correctOption = q.options.find((o) => o.isCorrect)?.text;
      return {
        questionId: q._id,
        type: q.type,
        questionText: q.questionText,
        marks: q.marks,
        options: q.options.map((o) => o.text),
        correctOption: correctOption ?? null,
        modelAnswer: q.correctAnswerText ?? null,
        source: (q as any).source,
        answered: !!a,
        selectedOption: a?.selectedOption ?? null,
        answerText: a?.answerText ?? null,
        marksAwarded: a?.marksAwarded ?? null,
        isCorrect: q.type === "mcq" && a ? a.selectedOption === correctOption : null
      };
    })
  });
}

// ---------- corrections (every one needs a reason and is audit-logged) ----------

// Give a student more time on an attempt that ended wrongly (crash, power cut).
export async function reopenAttempt(req: AuthedRequest, res: Response) {
  const reason = requireReason(req, res); if (!reason) return;
  const loaded = await loadAttempt(req, res); if (!loaded) return;
  const { attempt } = loaded;

  const extra = Math.floor(Number(req.body.extraMinutes));
  if (!extra || extra < 1 || extra > 180) return res.status(400).json({ error: "Extra minutes must be between 1 and 180." });
  if (attempt.status === "in-progress") return res.status(400).json({ error: "This attempt is already in progress." });

  const before = snapshot(attempt);
  attempt.status = "in-progress";
  attempt.submittedAt = undefined;
  attempt.serverEndTime = new Date(Date.now() + extra * 60 * 1000);
  await attempt.save();

  await logActivity(req, {
    action: "admin.reopen_attempt",
    summary: `Reopened an exam attempt for ${extra} minutes`,
    entityType: "attempt",
    entityId: attempt._id.toString(),
    targetUserId: attempt.studentId.toString(),
    meta: { reason, extraMinutes: extra, before, after: snapshot(attempt) }
  });
  res.json({ message: "Attempt reopened. The student can resume from where they stopped." });
}

// Delete an attempt so the student can start the exam fresh.
export async function resetAttempt(req: AuthedRequest, res: Response) {
  const reason = requireReason(req, res); if (!reason) return;
  const loaded = await loadAttempt(req, res); if (!loaded) return;
  const { attempt, exam } = loaded;

  if (exam.endTime.getTime() < Date.now()) {
    return res.status(400).json({ error: "The exam window has closed, so a fresh attempt couldn't be started. Reopen the attempt instead." });
  }

  const before = snapshot(attempt);
  await attempt.deleteOne();

  await logActivity(req, {
    action: "admin.reset_attempt",
    summary: "Reset an exam attempt so the student can start again",
    entityType: "attempt",
    entityId: attempt._id.toString(),
    targetUserId: attempt.studentId.toString(),
    meta: { reason, examId: exam._id, discarded: before }
  });
  res.json({ message: "Attempt removed. The student can start the exam again." });
}

// Recompute one attempt against the current answer key.
export async function regradeAttempt(req: AuthedRequest, res: Response) {
  const reason = requireReason(req, res); if (!reason) return;
  const loaded = await loadAttempt(req, res); if (!loaded) return;
  const { attempt } = loaded;
  if (attempt.status === "in-progress") return res.status(400).json({ error: "Wait until the attempt is submitted." });

  const before = snapshot(attempt);
  await gradeAttempt(attempt);

  await logActivity(req, {
    action: "admin.regrade_attempt",
    summary: `Regraded an attempt (${before.score ?? "—"} → ${attempt.score})`,
    entityType: "attempt",
    entityId: attempt._id.toString(),
    targetUserId: attempt.studentId.toString(),
    meta: { reason, before, after: snapshot(attempt) }
  });
  res.json({ score: attempt.score, needsGrading: attempt.needsGrading });
}

// Override the marks on one theory answer (e.g. a grading slip by the teacher).
export async function overrideMarks(req: AuthedRequest, res: Response) {
  const reason = requireReason(req, res); if (!reason) return;
  const loaded = await loadAttempt(req, res); if (!loaded) return;
  const { attempt } = loaded;

  const { questionId } = req.body as { questionId?: string };
  const marks = Number(req.body.marks);
  const question = questionId ? await Question.findById(questionId) : null;
  if (!question || question.type !== "theory") return res.status(400).json({ error: "Choose a theory question from this attempt." });
  if (!Number.isFinite(marks) || marks < 0 || marks > question.marks) {
    return res.status(400).json({ error: `Marks must be between 0 and ${question.marks}.` });
  }

  const answer = attempt.answers.find((a) => a.questionId.toString() === questionId);
  if (!answer) return res.status(400).json({ error: "The student didn't answer this question." });

  const previous = answer.marksAwarded ?? null;
  const before = snapshot(attempt);
  answer.marksAwarded = marks;
  answer.gradedAt = new Date();
  attempt.gradedBy = new mongoose.Types.ObjectId(req.user!.userId);
  await gradeAttempt(attempt);

  await logActivity(req, {
    action: "admin.override_marks",
    summary: `Changed theory marks (${previous ?? "ungraded"} → ${marks})`,
    entityType: "attempt",
    entityId: attempt._id.toString(),
    targetUserId: attempt.studentId.toString(),
    meta: { reason, questionId, previous, marks, before, after: snapshot(attempt) }
  });
  res.json({ score: attempt.score, needsGrading: attempt.needsGrading });
}

// Undo an integrity termination that was a false alarm (e.g. a notification
// stole focus). The flag events stay on record; only the termination is lifted.
export async function dismissFlags(req: AuthedRequest, res: Response) {
  const reason = requireReason(req, res); if (!reason) return;
  const loaded = await loadAttempt(req, res); if (!loaded) return;
  const { attempt } = loaded;
  if (attempt.status !== "flagged") return res.status(400).json({ error: "This attempt wasn't terminated for integrity violations." });

  const before = snapshot(attempt);
  attempt.status = "submitted";
  await attempt.save();

  await logActivity(req, {
    action: "admin.dismiss_flags",
    summary: "Lifted an integrity termination (marked as submitted normally)",
    entityType: "attempt",
    entityId: attempt._id.toString(),
    targetUserId: attempt.studentId.toString(),
    meta: { reason, before, after: snapshot(attempt) }
  });
  res.json({ message: "Termination lifted. The flag events remain on record." });
}

// After a teacher fixes a wrong answer key, recompute every finished attempt.
export async function regradeExam(req: AuthedRequest, res: Response) {
  const reason = requireReason(req, res); if (!reason) return;
  const exam = await Exam.findOne({ _id: req.params.examId, schoolId: req.user!.schoolId });
  if (!exam) return res.status(404).json({ error: "Exam not found" });

  let regraded = 0;
  let changed = 0;
  const cursor = ExamAttempt.find({ examId: exam._id, status: { $in: ["submitted", "auto-submitted", "flagged"] } }).cursor();
  for await (const attempt of cursor) {
    const prev = attempt.score;
    await gradeAttempt(attempt);
    regraded++;
    if (prev !== attempt.score) changed++;
  }

  await logActivity(req, {
    action: "admin.regrade_exam",
    summary: `Regraded all attempts for "${exam.title}" (${changed} score(s) changed)`,
    entityType: "exam",
    entityId: exam._id.toString(),
    meta: { reason, regraded, changed }
  });
  res.json({ regraded, changed });
}

// Closes out attempts that were abandoned: past their deadline but never
// submitted (student closed the browser), so they get a score and show up.
export async function finalizeExpired(req: AuthedRequest, res: Response) {
  const reason = requireReason(req, res); if (!reason) return;
  const exam = await Exam.findOne({ _id: req.params.examId, schoolId: req.user!.schoolId });
  if (!exam) return res.status(404).json({ error: "Exam not found" });

  let finalized = 0;
  const cursor = ExamAttempt.find({ examId: exam._id, status: "in-progress", serverEndTime: { $lt: new Date() } }).cursor();
  for await (const attempt of cursor) {
    attempt.status = "auto-submitted";
    attempt.submittedAt = attempt.serverEndTime;
    await gradeAttempt(attempt);
    finalized++;
  }

  await logActivity(req, {
    action: "admin.finalize_expired",
    summary: `Finalized ${finalized} abandoned attempt(s) for "${exam.title}"`,
    entityType: "exam",
    entityId: exam._id.toString(),
    meta: { reason, finalized }
  });
  res.json({ finalized });
}
