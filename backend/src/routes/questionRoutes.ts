import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  createQuestion,
  listQuestions,
  updateQuestion,
  deleteQuestion
} from "../controllers/questionController";
import { generateDraftQuestions, approveDrafts, regenerateDraft, discardDrafts, getAiUsage } from "../controllers/aiQuestionController";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(listQuestions));
router.post("/", requireRole("teacher"), asyncHandler(createQuestion));
router.post("/generate", requireRole("teacher"), asyncHandler(generateDraftQuestions));
router.get("/ai-usage", requireRole("teacher"), asyncHandler(getAiUsage));
router.post("/drafts/approve", requireRole("teacher"), asyncHandler(approveDrafts));
router.post("/drafts/discard", requireRole("teacher"), asyncHandler(discardDrafts));
router.post("/:id/regenerate", requireRole("teacher"), asyncHandler(regenerateDraft));
router.put("/:id", requireRole("teacher"), asyncHandler(updateQuestion));
router.delete("/:id", requireRole("teacher"), asyncHandler(deleteQuestion));

export default router;