import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  startOrResumeAttempt,
  autosaveAnswers,
  submitAttempt,
  flagEvent
} from "../controllers/attemptController";

const router = Router();
router.use(requireAuth);
router.use(requireRole("student"));

router.post("/:examId/start", asyncHandler(startOrResumeAttempt));
router.post("/:id/autosave", asyncHandler(autosaveAnswers));
router.post("/:id/flag", asyncHandler(flagEvent));
router.post("/:id/submit", asyncHandler(submitAttempt));

export default router;