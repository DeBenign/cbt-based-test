import { Router } from "express";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { getMyAnalytics, listAnalyticsOptions, getClassAnalytics } from "../controllers/analyticsController";
import { getSchoolOverview } from "../controllers/overviewController";
import { getStaffIndicators } from "../controllers/staffController";

// Students see only themselves. Teachers see the classes and subjects they teach; admins see
// every class (read-only, like the rest of the school's academic data).
const router = Router();

router.get("/me", requireRole("student"), asyncHandler(getMyAnalytics));
router.get("/options", requireRole("teacher", "admin"), asyncHandler(listAnalyticsOptions));
router.get("/overview", requireRole("admin"), asyncHandler(getSchoolOverview));
router.get("/staff", requireRole("teacher", "admin"), asyncHandler(getStaffIndicators));
router.get("/class", requireRole("teacher", "admin"), asyncHandler(getClassAnalytics));

export default router;
