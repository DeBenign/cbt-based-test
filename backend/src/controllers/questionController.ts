import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import Question from "../models/Question";
import User from "../models/User";

async function teacherOwnsSubject(userId: string, subjectId: string): Promise<boolean> {
  const teacher = await User.findById(userId).select("subjectIds");
  return !!teacher?.subjectIds?.some((id) => id.toString() === subjectId);
}

export async function createQuestion(req: AuthedRequest, res: Response) {
  const { subjectId, classId, topic, difficulty, type, questionText, options, correctAnswerText, marks, curriculumTag } = req.body;

  if (req.user!.role === "teacher" && !(await teacherOwnsSubject(req.user!.userId, subjectId))) {
    return res.status(403).json({ error: "You're not assigned to this subject." });
  }

  const questionType = type === "theory" ? "theory" : "mcq";

  if (questionType === "mcq") {
    if (!Array.isArray(options) || options.length < 2 || !options.some((o: any) => o.isCorrect)) {
      return res.status(400).json({ error: "MCQ questions need at least two options with one marked correct." });
    }
  }

  const question = await Question.create({
    schoolId: req.user!.schoolId,
    subjectId,
    classId,
    topic,
    type: questionType,
    difficulty,
    questionText,
    options: questionType === "mcq" ? options : [],
    correctAnswerText: questionType === "theory" ? correctAnswerText : undefined,
    marks,
    curriculumTag,
    createdBy: req.user!.userId
  });
  res.status(201).json(question);
}

export async function listQuestions(req: AuthedRequest, res: Response) {
  const { subjectId, classId, topic, difficulty, type, reviewStatus } = req.query;
  const filter: Record<string, unknown> = { schoolId: req.user!.schoolId };
  // AI drafts stay out of the normal bank until a teacher approves them.
  // (Older questions have no reviewStatus at all, hence $ne rather than "approved".)
  filter.reviewStatus = reviewStatus === "draft" ? "draft" : { $ne: "draft" };
  if (subjectId) filter.subjectId = subjectId;
  if (classId) filter.classId = classId;
  if (topic) filter.topic = topic;
  if (difficulty) filter.difficulty = difficulty;
  if (type) filter.type = type;

  const questions = await Question.find(filter).sort({ createdAt: -1 });
  res.json(questions);
}

export async function updateQuestion(req: AuthedRequest, res: Response) {
  const existing = await Question.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!existing) return res.status(404).json({ error: "Question not found" });

  if (req.user!.role === "teacher" && !(await teacherOwnsSubject(req.user!.userId, existing.subjectId.toString()))) {
    return res.status(403).json({ error: "You're not assigned to this subject." });
  }

  // Only editable content fields -- never schoolId, createdBy, reviewStatus etc.
  const allowed = ["topic", "difficulty", "questionText", "imageUrl", "options", "correctAnswerText", "marks", "curriculumTag"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) if (key in req.body) update[key] = req.body[key];

  const question = await Question.findOneAndUpdate(
    { _id: req.params.id, schoolId: req.user!.schoolId },
    update,
    { new: true, runValidators: true }
  );
  res.json(question);
}

export async function deleteQuestion(req: AuthedRequest, res: Response) {
  const existing = await Question.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!existing) return res.status(404).json({ error: "Question not found" });

  if (req.user!.role === "teacher" && !(await teacherOwnsSubject(req.user!.userId, existing.subjectId.toString()))) {
    return res.status(403).json({ error: "You're not assigned to this subject." });
  }

  await existing.deleteOne();
  res.status(204).send();
}