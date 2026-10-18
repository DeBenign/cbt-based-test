import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { listExams, getExam } from "../controllers/examController";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(listExams));
router.get("/:id", asyncHandler(getExam));

export default router;