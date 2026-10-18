import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import Exam from "../models/Exam";
import ExamAttempt from "../models/ExamAttempt";
import Question from "../models/Question";
import { gradeAttempt } from "../services/gradeAttempt";

const LOCKDOWN_VIOLATION_LIMIT = 3;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function buildQuestionPayload(questionOrder: any[], randomizeOptions: boolean) {
  const questions = await Question.find({ _id: { $in: questionOrder } });
  const questionsById = new Map(questions.map((q) => [q._id.toString(), q]));
  return questionOrder.map((id) => {
    const q = questionsById.get(id.toString())!;
    const plain: any = q.toObject();
    if (randomizeOptions && plain.type === "mcq") {
      plain.options = shuffle(plain.options);
    }
    // Never leak isCorrect to the student client.
    plain.options = plain.options?.map((o: any) => ({ text: o.text }));
    return plain;
  });
}

export async function startOrResumeAttempt(req: AuthedRequest, res: Response) {
  const exam = await Exam.findOne({ _id: req.params.examId, schoolId: req.user!.schoolId });
  if (!exam) return res.status(404).json({ error: "Exam not found" });

  const now = new Date();
  let attempt = await ExamAttempt.findOne({ examId: exam._id, studentId: req.user!.userId });

  if (attempt) {
    if (attempt.status !== "in-progress") {
      return res.status(409).json({ error: "You've already submitted this exam.", alreadySubmitted: true });
    }
    // Resume is judged by the attempt's own deadline, not the exam's status or
    // window: an admin may have reopened it after the window closed.
    if (now > attempt.serverEndTime) {
      return res.status(400).json({ error: "Your time for this exam has ended." });
    }
    // Already started -- return the SAME frozen question order and options,
    // not reshuffled, so a page refresh mid-exam shows the same exam instead
    // of a blank screen (options were previously only sent on first start).
    const orderedQuestions = await buildQuestionPayload(attempt.questionOrder, false);
    return res.json({ attempt, questions: orderedQuestions, lockdownRequired: exam.lockdownRequired });
  }

  if (exam.status !== "scheduled" && exam.status !== "live") {
    return res.status(400).json({ error: "Exam is not open" });
  }
  if (now < exam.startTime) return res.status(400).json({ error: "Exam has not started yet" });
  if (now > exam.endTime) return res.status(400).json({ error: "Exam window has closed" });

  let questionOrder = exam.questionIds.map((id) => id.toString());
  if (exam.randomizeQuestions) questionOrder = shuffle(questionOrder);

  const serverEndTime = new Date(Math.min(
    now.getTime() + exam.duration * 60 * 1000,
    exam.endTime.getTime()
  ));

  attempt = await ExamAttempt.create({
    examId: exam._id,
    studentId: req.user!.userId,
    questionOrder,
    startedAt: now,
    serverEndTime,
    status: "in-progress",
    answers: [],
    flaggedEvents: []
  });

  const orderedQuestions = await buildQuestionPayload(questionOrder, exam.randomizeOptions);
  res.status(201).json({ attempt, questions: orderedQuestions, lockdownRequired: exam.lockdownRequired });
}

export async function autosaveAnswers(req: AuthedRequest, res: Response) {
  const { answers } = req.body as {
    answers: { questionId: string; selectedOption?: string; answerText?: string; clientTimestamp: number }[];
  };

  const attempt = await ExamAttempt.findOne({ _id: req.params.id, studentId: req.user!.userId });
  if (!attempt) return res.status(404).json({ error: "Attempt not found" });
  if (attempt.status !== "in-progress") {
    return res.status(400).json({ error: "Attempt is no longer active" });
  }
  if (new Date() > attempt.serverEndTime) {
    return autoSubmit(attempt, res);
  }

  for (const incoming of answers) {
    const existingIndex = attempt.answers.findIndex(
      (a) => a.questionId.toString() === incoming.questionId
    );
    const record = { ...incoming, serverReceivedAt: new Date() } as any;

    if (existingIndex === -1) {
      attempt.answers.push(record);
    } else if (attempt.answers[existingIndex].clientTimestamp < incoming.clientTimestamp) {
      attempt.answers[existingIndex] = record;
    }
  }

  await attempt.save();
  res.json({ synced: true, syncedAt: new Date(), remainingMs: attempt.serverEndTime.getTime() - Date.now() });
}

// Student's client reports a suspected integrity violation (tab switch,
// window blur, exiting fullscreen, a blocked shortcut attempt). Always
// logged for teacher review; for a lockdown-required exam, repeated
// violations end the attempt immediately rather than just logging it.
export async function flagEvent(req: AuthedRequest, res: Response) {
  const { type, meta } = req.body as { type: string; meta?: string };
  const validTypes = ["tab-switch", "window-blur", "fullscreen-exit", "disconnect", "blocked-shortcut"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: "Invalid flag type" });
  }

  const attempt = await ExamAttempt.findOne({ _id: req.params.id, studentId: req.user!.userId });
  if (!attempt) return res.status(404).json({ error: "Attempt not found" });
  if (attempt.status !== "in-progress") {
    return res.status(400).json({ error: "Attempt is no longer active" });
  }

  // timestamp set server-side, not trusting the client's clock for a
  // security-relevant log
  attempt.flaggedEvents.push({ type: type as any, timestamp: Date.now(), meta });

  const exam = await Exam.findById(attempt.examId);
  const violationCount = attempt.flaggedEvents.length;

  if (exam?.lockdownRequired && violationCount >= LOCKDOWN_VIOLATION_LIMIT) {
    attempt.status = "flagged";
    attempt.submittedAt = new Date();
    await attempt.save();
    await gradeAttempt(attempt);
    return res.json({ terminated: true, reason: "Too many integrity violations", violationCount });
  }

  await attempt.save();
  res.json({ terminated: false, violationCount });
}

export async function submitAttempt(req: AuthedRequest, res: Response) {
  const attempt = await ExamAttempt.findOne({ _id: req.params.id, studentId: req.user!.userId });
  if (!attempt) return res.status(404).json({ error: "Attempt not found" });
  if (attempt.status !== "in-progress") {
    return res.status(400).json({ error: "Attempt already finalized" });
  }

  attempt.status = "submitted";
  attempt.submittedAt = new Date();
  await attempt.save();
  await gradeAttempt(attempt);
  res.json(attempt);
}

async function autoSubmit(attempt: any, res: Response) {
  attempt.status = "auto-submitted";
  attempt.submittedAt = attempt.serverEndTime;
  await attempt.save();
  await gradeAttempt(attempt);
  return res.status(200).json({ error: "Time expired, attempt auto-submitted", attempt });
}
