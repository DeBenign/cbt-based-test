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
import { generateDraftQuestions, approveDrafts } from "../controllers/aiQuestionController";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(listQuestions));
router.post("/", requireRole("teacher"), asyncHandler(createQuestion));
router.post("/generate", requireRole("teacher"), asyncHandler(generateDraftQuestions));
router.post("/drafts/approve", requireRole("teacher"), asyncHandler(approveDrafts));
router.put("/:id", requireRole("teacher"), asyncHandler(updateQuestion));
router.delete("/:id", requireRole("teacher"), asyncHandler(deleteQuestion));

export default router;