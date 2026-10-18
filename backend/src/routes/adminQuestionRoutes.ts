import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { listQuestions } from "../controllers/questionController";

const router = Router();
router.use(requireAuth);

// Oversight only — full school-wide bank, no create/edit/delete exposed here.
router.get("/", asyncHandler(listQuestions));

export default router;