import { Router } from "express";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { getClassReportCards, getMyReportCard } from "../controllers/reportCardController";

const router = Router();
router.get("/class", requireRole("admin"), asyncHandler(getClassReportCards));
router.get("/me", requireRole("student"), asyncHandler(getMyReportCard));
export default router;
