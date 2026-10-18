import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  createExam,
  getExam,
  listExams,
  updateExam,
  deleteExam,
  attachQuestions,
  removeQuestion,
  autoFill,
  publishExam
} from "../controllers/examController";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(listExams));
router.get("/:id", asyncHandler(getExam));
router.post("/", requireRole("teacher"), asyncHandler(createExam));
router.put("/:id", requireRole("teacher"), asyncHandler(updateExam));
router.delete("/:id", requireRole("teacher"), asyncHandler(deleteExam));

router.post("/:id/questions", requireRole("teacher"), asyncHandler(attachQuestions));
router.delete("/:id/questions/:qId", requireRole("teacher"), asyncHandler(removeQuestion));
router.post("/:id/auto-fill", requireRole("teacher"), asyncHandler(autoFill));
router.post("/:id/publish", requireRole("teacher"), asyncHandler(publishExam));

export default router;