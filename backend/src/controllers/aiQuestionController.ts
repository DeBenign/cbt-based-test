import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import Curriculum from "../models/Curriculum";
import Question from "../models/Question";
import Subject from "../models/Subject";
import Class from "../models/Class";
import User from "../models/User";
import { generateQuestions, AiNotConfiguredError } from "../services/questionGenerator";
import { logActivity } from "../utils/activity";

const MAX_PER_REQUEST = 15;

async function ownedSubjectIds(userId: string): Promise<string[]> {
  const t = await User.findById(userId).select("subjectIds");
  return (t?.subjectIds || []).map((id) => id.toString());
}

// Teacher picks a curriculum (and optionally some of its topics) and how many
// questions they want. Results are saved as DRAFTS -- they can't enter an exam
// until the teacher reviews and approves them.
export async function generateDraftQuestions(req: AuthedRequest, res: Response) {
  const { curriculumId, topicIndexes, difficulty } = req.body as {
    curriculumId?: string;
    topicIndexes?: number[];
    difficulty?: "easy" | "medium" | "hard" | "mixed";
  };
  const mcqCount = Math.max(0, Math.floor(Number(req.body.mcqCount) || 0));
  const theoryCount = Math.max(0, Math.floor(Number(req.body.theoryCount) || 0));
  const theoryMarks = Math.min(20, Math.max(1, Math.floor(Number(req.body.theoryMarks) || 5)));

  if (!curriculumId) return res.status(400).json({ error: "Choose a curriculum first." });
  if (mcqCount + theoryCount === 0) return res.status(400).json({ error: "Ask for at least one question." });
  if (mcqCount + theoryCount > MAX_PER_REQUEST) {
    return res.status(400).json({ error: `Generate at most ${MAX_PER_REQUEST} questions at a time. You can run it again for more.` });
  }

  const curriculum = await Curriculum.findOne({ _id: curriculumId, schoolId: req.user!.schoolId });
  if (!curriculum) return res.status(404).json({ error: "Curriculum not found." });

  if (!(await ownedSubjectIds(req.user!.userId)).includes(curriculum.subjectId.toString())) {
    return res.status(403).json({ error: "You're not assigned to this subject." });
  }

  const [subject, cls] = await Promise.all([Subject.findById(curriculum.subjectId), Class.findById(curriculum.classId)]);

  const chosen = Array.isArray(topicIndexes) && topicIndexes.length > 0
    ? topicIndexes.filter((i) => Number.isInteger(i) && i >= 0 && i < curriculum.topics.length).map((i) => curriculum.topics[i])
    : curriculum.topics;
  if (chosen.length === 0) return res.status(400).json({ error: "None of the selected topics exist in this curriculum." });

  let generated;
  try {
    generated = await generateQuestions({
      subjectName: subject?.name || "the subject",
      className: cls?.name || "the class",
      topics: chosen.map((t) => ({ title: t.title, text: t.text })),
      mcqCount,
      theoryCount,
      difficulty: difficulty || "mixed",
      theoryMarks
    });
  } catch (err: any) {
    if (err instanceof AiNotConfiguredError) {
      return res.status(503).json({ error: "AI question generation isn't switched on for this platform yet. Ask the platform owner to set the ANTHROPIC_API_KEY." });
    }
    console.error("AI generation failed", err);
    return res.status(502).json({ error: "The AI service couldn't produce questions right now. Try again, or pick fewer topics or questions." });
  }

  if (generated.valid.length === 0) {
    return res.status(502).json({ error: "The AI's answer didn't pass validation. Please try again." });
  }

  const drafts = await Question.insertMany(
    generated.valid.map((q) => ({
      schoolId: req.user!.schoolId,
      subjectId: curriculum.subjectId,
      classId: curriculum.classId,
      topic: q.topic,
      type: q.type,
      difficulty: q.difficulty,
      questionText: q.questionText,
      options: q.options,
      correctAnswerText: q.correctAnswerText,
      marks: q.marks,
      curriculumTag: `AI: ${curriculum.title}`,
      curriculumId: curriculum._id,
      reviewStatus: "draft",
      source: "ai",
      createdBy: req.user!.userId
    }))
  );

  await logActivity(req, {
    action: "questions.ai_generate",
    summary: `Generated ${drafts.length} AI draft question(s) from "${curriculum.title}"`,
    entityType: "curriculum",
    entityId: curriculum._id.toString(),
    meta: { requested: mcqCount + theoryCount, saved: drafts.length, rejected: generated.rejected }
  });

  res.status(201).json({ drafts, rejected: generated.rejected, requested: mcqCount + theoryCount });
}

// Teacher approves reviewed drafts (all must be in subjects they teach).
export async function approveDrafts(req: AuthedRequest, res: Response) {
  const { ids } = req.body as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "No questions selected." });

  const subjectIds = await ownedSubjectIds(req.user!.userId);
  const result = await Question.updateMany(
    { _id: { $in: ids }, schoolId: req.user!.schoolId, reviewStatus: "draft", subjectId: { $in: subjectIds } },
    { $set: { reviewStatus: "approved" } }
  );

  await logActivity(req, {
    action: "questions.approve_drafts",
    summary: `Approved ${result.modifiedCount} AI draft question(s)`,
    entityType: "question",
    meta: { count: result.modifiedCount }
  });

  res.json({ approved: result.modifiedCount });
}
