import { Router } from "express";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { getMyAnalytics, listAnalyticsOptions, getClassAnalytics } from "../controllers/analyticsController";

// Students see only themselves. Teachers see the classes and subjects they teach; admins see
// every class (read-only, like the rest of the school's academic data).
const router = Router();

router.get("/me", requireRole("student"), asyncHandler(getMyAnalytics));
router.get("/options", requireRole("teacher", "admin"), asyncHandler(listAnalyticsOptions));
router.get("/class", requireRole("teacher", "admin"), asyncHandler(getClassAnalytics));

export default router;
