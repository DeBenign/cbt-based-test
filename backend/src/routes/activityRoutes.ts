import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { getFeed, listPeople, getUserActivity } from "../controllers/activityController";

// Mounted at /admin/activity with admin-only auth in app.ts.
const router = Router();
router.get("/", asyncHandler(getFeed));
router.get("/people", asyncHandler(listPeople));
router.get("/users/:userId", asyncHandler(getUserActivity));

export default router;
