import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  listAttempts, getAttemptDetail, reopenAttempt, resetAttempt, regradeAttempt,
  overrideMarks, dismissFlags, regradeExam, finalizeExpired
} from "../controllers/reviewController";

// Mounted at /admin/review with admin-only auth in app.ts.
const router = Router();
router.get("/attempts", asyncHandler(listAttempts));
router.get("/attempts/:id", asyncHandler(getAttemptDetail));
router.post("/attempts/:id/reopen", asyncHandler(reopenAttempt));
router.post("/attempts/:id/reset", asyncHandler(resetAttempt));
router.post("/attempts/:id/regrade", asyncHandler(regradeAttempt));
router.post("/attempts/:id/marks", asyncHandler(overrideMarks));
router.post("/attempts/:id/dismiss-flags", asyncHandler(dismissFlags));
router.post("/exams/:examId/regrade", asyncHandler(regradeExam));
router.post("/exams/:examId/finalize-expired", asyncHandler(finalizeExpired));

export default router;
