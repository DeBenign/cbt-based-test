import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { teacherExamGuard } from "../middleware/teacherExamGuard";
import { getGradingQueue, gradeAnswer } from "../controllers/gradingController";

const router = Router();
router.use(requireAuth);
router.param("examId", teacherExamGuard);
router.use(requireRole("teacher"));

router.get("/exams/:examId", asyncHandler(getGradingQueue));
router.post("/attempts/:attemptId/questions/:questionId", asyncHandler(gradeAnswer));

export default router;