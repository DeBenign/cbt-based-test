import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { getMyBranding, updateBranding } from "../controllers/brandingController";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(getMyBranding));
router.put("/", requireRole("admin"), asyncHandler(updateBranding));

export default router;