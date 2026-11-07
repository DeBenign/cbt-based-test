import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { listAiReports, resolveAiReport } from "../controllers/aiReportController";

const router = Router();
router.use(requireAuth, requireRole("superadmin"));

router.get("/", asyncHandler(listAiReports));
router.put("/:id/resolve", asyncHandler(resolveAiReport));

export default router;
