import { Response } from "express";
import mongoose from "mongoose";
import { AuthedRequest } from "../middleware/auth";
import Exam from "../models/Exam";
import Question from "../models/Question";
import User from "../models/User";

export async function createExam(req: AuthedRequest, res: Response) {
  const { subjectId, classId, title, duration, startTime, endTime, randomizeQuestions, randomizeOptions, lockdownRequired } = req.body;

  if (req.user!.role === "teacher") {
    const teacher = await User.findById(req.user!.userId).select("subjectIds");
    const owns = teacher?.subjectIds?.some((id) => id.toString() === subjectId);
    if (!owns) {
      return res.status(403).json({ error: "You're not assigned to this subject." });
    }
  }

  const exam = await Exam.create({
    schoolId: req.user!.schoolId,
    subjectId,
    classId,
    title,
    duration,
    startTime,
    endTime,
    randomizeQuestions: randomizeQuestions ?? true,
    randomizeOptions: randomizeOptions ?? true,
    lockdownRequired: lockdownRequired ?? false,
    status: "draft",
    createdBy: req.user!.userId,
    questionIds: []
  });

  res.status(201).json(exam);
}
export async function getExam(req: AuthedRequest, res: Response) {
  const exam = await Exam.findOne({ _id: req.params.id, schoolId: req.user!.schoolId }).populate("questionIds");
  if (!exam) return res.status(404).json({ error: "Exam not found" });
  res.json(exam);
}

export async function listExams(req: AuthedRequest, res: Response) {
  const { classId, status } = req.query;
  const filter: Record<string, unknown> = { schoolId: req.user!.schoolId };

  if (req.user!.role === "student") {
    // Students only ever see their own class's exams, and never a draft --
    // drafts are a teacher's in-progress work, not something to expose.
    const student = await User.findById(req.user!.userId).select("classId");
    filter.classId = student?.classId;
    filter.status = { $ne: "draft" };
  } else {
    if (classId) filter.classId = classId;
    if (status) filter.status = status;
  }

   await Exam.updateMany(
    { schoolId: req.user!.schoolId, status: "scheduled", endTime: { $lt: new Date() } },
    { $set: { status: "closed" } }
  );

  const exams = await Exam.find(filter).sort({ startTime: 1 });
  res.json(exams);
}

export async function updateExam(req: AuthedRequest, res: Response) {
  const exam = await Exam.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!exam) return res.status(404).json({ error: "Exam not found" });
  if (exam.status !== "draft") {
    return res.status(400).json({ error: "Only draft exams can be edited" });
  }

  Object.assign(exam, req.body);
  await exam.save();
  res.json(exam);
}

export async function deleteExam(req: AuthedRequest, res: Response) {
  const exam = await Exam.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!exam) return res.status(404).json({ error: "Exam not found" });
  if (exam.status !== "draft") {
    return res.status(400).json({ error: "Only draft exams can be deleted" });
  }
  await exam.deleteOne();
  res.status(204).send();
}

export async function attachQuestions(req: AuthedRequest, res: Response) {
  const { questionIds } = req.body as { questionIds: string[] };
  const exam = await Exam.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!exam) return res.status(404).json({ error: "Exam not found" });
  if (exam.status !== "draft") {
    return res.status(400).json({ error: "Only draft exams can be modified" });
  }

  // Only questions from this school, and never un-reviewed AI drafts.
  const valid = await Question.find({
    _id: { $in: questionIds },
    schoolId: req.user!.schoolId,
    reviewStatus: { $ne: "draft" }
  }).select("_id");
  const validIds = valid.map((q) => q._id.toString());

  const existing = exam.questionIds.map((id) => id.toString());
  const merged = Array.from(new Set([...existing, ...validIds]));
  exam.questionIds = merged as any;
  await exam.save();
  res.json(exam);
}

export async function removeQuestion(req: AuthedRequest, res: Response) {
  const exam = await Exam.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!exam) return res.status(404).json({ error: "Exam not found" });
  if (exam.status !== "draft") {
    return res.status(400).json({ error: "Only draft exams can be modified" });
  }

  exam.questionIds = exam.questionIds.filter((id) => id.toString() !== req.params.qId) as any;
  await exam.save();
  res.json(exam);
}

// Server-side weighted random sample from the question bank matching criteria.
export async function autoFill(req: AuthedRequest, res: Response) {
  const { topics, difficulty, count } = req.body as {
    topics?: string[];
    difficulty?: "easy" | "medium" | "hard" | "mixed";
    count: number;
  };

  const exam = await Exam.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!exam) return res.status(404).json({ error: "Exam not found" });
  if (exam.status !== "draft") {
    return res.status(400).json({ error: "Only draft exams can be modified" });
  }

  // IMPORTANT: aggregate() does NOT apply Mongoose's automatic schema
  // casting to $match (that only happens on find()/findOne()). schoolId
  // comes out of the JWT as a plain string, but is stored as an ObjectId
  // in MongoDB -- so it must be cast explicitly here or this will match
  // zero documents every time, silently.
  const filter: Record<string, unknown> = {
    schoolId: new mongoose.Types.ObjectId(req.user!.schoolId),
    subjectId: exam.subjectId,
    classId: exam.classId,
    type: "mcq",
    reviewStatus: { $ne: "draft" }
  };
  if (topics && topics.length > 0) {
    // Case-insensitive match -- "marriage" should still find a "Marriage" topic.
    filter.topic = { $in: topics.map((t) => new RegExp(`^${t.trim()}$`, "i")) };
  }
  if (difficulty && difficulty !== "mixed") filter.difficulty = difficulty;

  // $sample gives a random selection at the DB level -- avoids pulling
  // the whole bank into memory just to shuffle it.
  const sampled = await Question.aggregate([
    { $match: filter },
    { $sample: { size: count } }
  ]);

  if (sampled.length === 0) {
    // Don't overwrite whatever the exam already had with an empty array --
    // just report that nothing matched so the user can adjust and retry.
    return res.status(400).json({
      error: "No questions in the bank matched that subject/topic/difficulty. Check the topic spelling, or leave topics blank to match any."
    });
  }

  exam.questionIds = sampled.map((q) => q._id);
  await exam.save();
  res.json({ exam, addedCount: sampled.length, requestedCount: count });
}

function validateForPublish(exam: any): string | null {
  if (!exam.questionIds || exam.questionIds.length === 0) {
    return "Exam must have at least one question";
  }
  if (new Date(exam.startTime).getTime() <= Date.now()) {
    return "Start time must be in the future";
  }
  if (new Date(exam.endTime).getTime() <= new Date(exam.startTime).getTime()) {
    return "End time must be after start time";
  }
  return null;
}

export async function publishExam(req: AuthedRequest, res: Response) {
  const exam = await Exam.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!exam) return res.status(404).json({ error: "Exam not found" });
  if (exam.status !== "draft") {
    return res.status(400).json({ error: "Only draft exams can be published" });
  }

  const validationError = validateForPublish(exam);
  if (validationError) return res.status(400).json({ error: validationError });

  // Avoid double-booking the same class+subject over an overlapping window
  // (e.g. two exams competing for the same computer lab slot).
  const overlap = await Exam.findOne({
    schoolId: req.user!.schoolId,
    classId: exam.classId,
    subjectId: exam.subjectId,
    status: { $in: ["scheduled", "live"] },
    _id: { $ne: exam._id },
    startTime: { $lt: exam.endTime },
    endTime: { $gt: exam.startTime }
  });
  if (overlap) {
    return res.status(409).json({ error: "Overlapping exam already scheduled for this class/subject" });
  }

  exam.status = "scheduled";
  await exam.save();
  res.json(exam);
}