import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import Question from "../models/Question";
import { loadTeacherScope, denyReason, scopeFilter } from "../utils/teacherScope";

// Teachers only work in the subjects AND classes assigned to them. Returns the reason, or null if allowed.
async function teacherDenied(req: AuthedRequest, subjectId: unknown, classId: unknown): Promise<string | null> {
  if (req.user!.role !== "teacher") return null;
  return denyReason(await loadTeacherScope(req.user!.userId), subjectId, classId);
}

export async function createQuestion(req: AuthedRequest, res: Response) {
  const { subjectId, classId, topic, difficulty, type, questionText, options, correctAnswerText, marks, curriculumTag } = req.body;

  const denied = await teacherDenied(req, subjectId, classId);
  if (denied) return res.status(403).json({ error: denied });

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

  // A teacher only ever sees the bank for their own subjects and classes.
  if (req.user!.role === "teacher") {
    const scope = await loadTeacherScope(req.user!.userId);
    const allowed = scopeFilter(scope);
    const wantsSubject = subjectId ? scope.subjectIds.includes(String(subjectId)) : true;
    const wantsClass = classId ? scope.classIds.includes(String(classId)) : true;
    if (!wantsSubject || !wantsClass) return res.json([]);
    if (!subjectId) filter.subjectId = allowed.subjectId;
    if (!classId) filter.classId = allowed.classId;
  }

  const questions = await Question.find(filter).sort({ createdAt: -1 }).lean();
  res.json(questions);
}

export async function updateQuestion(req: AuthedRequest, res: Response) {
  const existing = await Question.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!existing) return res.status(404).json({ error: "Question not found" });

  const denied = await teacherDenied(req, existing.subjectId, existing.classId);
  if (denied) return res.status(403).json({ error: denied });

  // Only editable content fields -- never schoolId, createdBy, reviewStatus etc.
  const allowed = ["topic", "difficulty", "questionText", "imageUrl", "options", "correctAnswerText", "marks", "curriculumTag"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) if (key in req.body) update[key] = req.body[key];

  // Editing the wording or options makes an earlier AI second-check out of date, so it is cleared.
  const mongoUpdate: Record<string, unknown> = { $set: update };
  if ("questionText" in update || "options" in update) mongoUpdate.$unset = { aiCheck: 1 };

  const question = await Question.findOneAndUpdate(
    { _id: req.params.id, schoolId: req.user!.schoolId },
    mongoUpdate,
    { new: true, runValidators: true }
  );
  res.json(question);
}

export async function deleteQuestion(req: AuthedRequest, res: Response) {
  const existing = await Question.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!existing) return res.status(404).json({ error: "Question not found" });

  const denied = await teacherDenied(req, existing.subjectId, existing.classId);
  if (denied) return res.status(403).json({ error: denied });

  await existing.deleteOne();
  res.status(204).send();
}