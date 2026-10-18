import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  getMyResult,
  getExamResults,
  getStudentSummary,
  exportExamResultsCsv
} from "../controllers/resultController";

const router = Router();
router.use(requireAuth);

router.get("/mine/:examId", requireRole("student"), asyncHandler(getMyResult));
router.get("/exam/:examId", requireRole("teacher", "admin"), asyncHandler(getExamResults));
router.get("/exam/:examId/export", requireRole("teacher", "admin"), asyncHandler(exportExamResultsCsv));
router.get("/student/:studentId", requireRole("teacher", "admin"), asyncHandler(getStudentSummary));

export default router;