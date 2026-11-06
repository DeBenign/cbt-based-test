import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import Curriculum from "../models/Curriculum";
import Question from "../models/Question";
import Subject from "../models/Subject";
import Class from "../models/Class";
import User from "../models/User";
import { generateQuestions, checkDifficultyMix, AiNotConfiguredError, AiAccountError, DifficultyMix, GenerateParams } from "../services/questionGenerator";
import { filterDuplicates } from "../services/questionDedupe";
import { verifyMcqs, AiCheck } from "../services/answerCheck";
import { schoolAllowance, recordUsage, limitMessage } from "../services/aiUsage";
import { logActivity } from "../utils/activity";

const MAX_PER_REQUEST = 15;

async function ownedSubjectIds(userId: string): Promise<string[]> {
  const t = await User.findById(userId).select("subjectIds");
  return (t?.subjectIds || []).map((id) => id.toString());
}

// Existing question wording for this class and subject (drafts and approved), used to avoid repeats.
async function existingTexts(schoolId: string, subjectId: unknown, classId: unknown, excludeId?: unknown): Promise<string[]> {
  const filter: Record<string, unknown> = { schoolId, subjectId, classId };
  if (excludeId) filter._id = { $ne: excludeId };
  const rows = await Question.find(filter).select("questionText").limit(3000).lean();
  return rows.map((r: any) => r.questionText as string);
}

const withCheck = (c: AiCheck | null) => (c ? { aiCheck: { ...c, checkedAt: new Date() } } : {});

function sendAiError(res: Response, err: any) {
  if (err instanceof AiNotConfiguredError) {
    return res.status(503).json({ error: "AI question generation isn't switched on for this platform yet. Ask the platform owner to set the ANTHROPIC_API_KEY." });
  }
  if (err instanceof AiAccountError) {
    console.error("AI account problem:", err.reason, err.message);
    return res.status(503).json({
      error: err.reason === "credits"
        ? "AI question generation is paused: the platform's AI credits have run out. Please tell the platform owner."
        : "AI question generation is paused: the platform's AI key needs renewing. Please tell the platform owner."
    });
  }
  console.error("AI generation failed", err);
  return res.status(502).json({ error: "The AI service couldn't produce questions right now. Try again, or pick fewer topics or questions." });
}

// The school's AI allowance for this month (teachers see it on the AI page, admins on Billing).
export async function getAiUsage(req: AuthedRequest, res: Response) {
  const a = await schoolAllowance(req.user!.schoolId);
  res.json({ limit: a.limit, used: a.used, remaining: a.remaining, resetsOn: a.resetsOn });
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

  let mix: DifficultyMix | undefined;
  if (req.body.difficultyMix) {
    const checked = checkDifficultyMix(req.body.difficultyMix, mcqCount + theoryCount);
    if (!checked.ok) return res.status(400).json({ error: checked.error });
    mix = checked.mix;
  }

  const allowance = await schoolAllowance(req.user!.schoolId);
  if (mcqCount + theoryCount > allowance.remaining) {
    return res.status(429).json({ error: limitMessage(allowance.remaining, allowance.resetsOn) });
  }

  let generated;
  try {
    generated = await generateQuestions({
      subjectName: subject?.name || "the subject",
      className: cls?.name || "the class",
      topics: chosen.map((t) => ({ title: t.title, text: t.text })),
      mcqCount,
      theoryCount,
      difficulty: difficulty || "mixed",
      difficultyMix: mix,
      theoryMarks
    });
  } catch (err: any) {
    if (err?.usage) await recordUsage({ schoolId: req.user!.schoolId, userId: req.user!.userId, curriculumId, kind: "generate", modelName: err.usage.model, inputTokens: err.usage.inputTokens, outputTokens: err.usage.outputTokens, requested: mcqCount + theoryCount, saved: 0, rejected: 0 });
    return sendAiError(res, err);
  }

  // Drop anything that repeats a question already in the bank, then get a second opinion on the rest.
  const existing = await existingTexts(req.user!.schoolId, curriculum.subjectId, curriculum.classId);
  const { kept, duplicates } = filterDuplicates(generated.valid, existing);
  const verified = await verifyMcqs(kept, { subjectName: subject?.name || "the subject", className: cls?.name || "the class" });

  // Tokens were spent whether or not anything survived, so record before answering.
  await recordUsage({
    schoolId: req.user!.schoolId, userId: req.user!.userId, curriculumId, kind: "generate",
    modelName: generated.usage.model,
    inputTokens: generated.usage.inputTokens + verified.inputTokens,
    outputTokens: generated.usage.outputTokens + verified.outputTokens,
    requested: mcqCount + theoryCount, saved: kept.length, rejected: generated.rejected + duplicates.length
  });

  if (kept.length === 0) {
    return res.status(502).json({
      error: duplicates.length > 0
        ? "Every question the AI wrote was already in your question bank. Try other topics, or a different difficulty."
        : "The AI's answer didn't pass validation. Please try again."
    });
  }

  const drafts = await Question.insertMany(
    kept.map((q, i) => ({
      ...withCheck(verified.checks[i]),
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
    meta: { requested: mcqCount + theoryCount, saved: drafts.length, rejected: generated.rejected, duplicates: duplicates.length }
  });

  const flagged = verified.checks.filter((c) => c && c.status !== "agreed").length;
  res.status(201).json({ drafts, rejected: generated.rejected, duplicates: duplicates.length, flagged, requested: mcqCount + theoryCount });
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

// Replace one unsatisfactory draft with a fresh question of the same type, topic and difficulty.
export async function regenerateDraft(req: AuthedRequest, res: Response) {
  const draft = await Question.findOne({ _id: req.params.id, schoolId: req.user!.schoolId, reviewStatus: "draft", source: "ai" });
  if (!draft) return res.status(404).json({ error: "Draft not found." });
  if (!(await ownedSubjectIds(req.user!.userId)).includes(draft.subjectId.toString())) {
    return res.status(403).json({ error: "You're not assigned to this subject." });
  }
  if (!draft.curriculumId) return res.status(400).json({ error: "This draft isn't linked to a curriculum, so it can't be regenerated." });

  const curriculum = await Curriculum.findOne({ _id: draft.curriculumId, schoolId: req.user!.schoolId });
  if (!curriculum) return res.status(404).json({ error: "The curriculum for this draft no longer exists." });

  const allowance = await schoolAllowance(req.user!.schoolId);
  if (allowance.remaining < 1) return res.status(429).json({ error: limitMessage(0, allowance.resetsOn) });

  const [subject, cls] = await Promise.all([Subject.findById(draft.subjectId), Class.findById(draft.classId)]);
  const sameTopic = curriculum.topics.filter((t) => t.title === draft.topic);
  const topics = (sameTopic.length ? sameTopic : curriculum.topics).map((t) => ({ title: t.title, text: t.text }));
  const isMcq = draft.type === "mcq";

  const params: GenerateParams = {
    subjectName: subject?.name || "the subject",
    className: cls?.name || "the class",
    topics,
    mcqCount: isMcq ? 1 : 0,
    theoryCount: isMcq ? 0 : 1,
    difficulty: draft.difficulty,
    theoryMarks: draft.marks || 5,
    avoid: [draft.questionText]
  };

  let generated;
  try {
    generated = await generateQuestions(params);
  } catch (err: any) {
    if (err?.usage) await recordUsage({ schoolId: req.user!.schoolId, userId: req.user!.userId, curriculumId: curriculum._id.toString(), kind: "regenerate", modelName: err.usage.model, inputTokens: err.usage.inputTokens, outputTokens: err.usage.outputTokens, requested: 1, saved: 0, rejected: 0 });
    return sendAiError(res, err);
  }

  const existing = await existingTexts(req.user!.schoolId, draft.subjectId, draft.classId, draft._id);
  const { kept } = filterDuplicates(generated.valid.slice(0, 1), existing);
  const replacement = kept[0];
  const verified = replacement ? await verifyMcqs([replacement], { subjectName: params.subjectName, className: params.className }) : null;

  await recordUsage({
    schoolId: req.user!.schoolId, userId: req.user!.userId, curriculumId: curriculum._id.toString(), kind: "regenerate",
    modelName: generated.usage.model,
    inputTokens: generated.usage.inputTokens + (verified?.inputTokens ?? 0),
    outputTokens: generated.usage.outputTokens + (verified?.outputTokens ?? 0),
    requested: 1, saved: replacement ? 1 : 0, rejected: generated.rejected + (generated.valid.length > 0 && !replacement ? 1 : 0)
  });
  if (!replacement) {
    return res.status(502).json({ error: generated.valid.length > 0 ? "The new question was too similar to one you already have. Try again." : "The AI's answer didn't pass validation. Please try again." });
  }

  draft.topic = replacement.topic;
  draft.difficulty = replacement.difficulty;
  draft.questionText = replacement.questionText;
  draft.options = replacement.options;
  draft.correctAnswerText = replacement.correctAnswerText;
  draft.marks = replacement.marks;
  const check = verified?.checks[0];
  draft.aiCheck = check ? { ...check, checkedAt: new Date() } : undefined;
  await draft.save();

  await logActivity(req, {
    action: "questions.ai_regenerate",
    summary: `Regenerated an AI draft question from "${curriculum.title}"`,
    entityType: "question",
    entityId: draft._id.toString()
  });

  res.json(draft);
}

// Throw away drafts (used by "Regenerate all"). Approved questions are never touched.
export async function discardDrafts(req: AuthedRequest, res: Response) {
  const { ids } = req.body as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "No drafts selected." });

  const subjectIds = await ownedSubjectIds(req.user!.userId);
  const result = await Question.deleteMany({
    _id: { $in: ids }, schoolId: req.user!.schoolId, reviewStatus: "draft", subjectId: { $in: subjectIds }
  });

  await logActivity(req, {
    action: "questions.discard_drafts",
    summary: `Discarded ${result.deletedCount} AI draft question(s)`,
    entityType: "question",
    meta: { count: result.deletedCount }
  });

  res.json({ discarded: result.deletedCount });
}
