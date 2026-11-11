import { Router } from "express";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { listRemarks, generateRemarks, editRemark, releaseRemarks, getMyRemarks } from "../controllers/remarkController";

// Students read their released remarks. Teachers manage subject remarks; the school admin manages the overall remark.
const router = Router();

router.get("/me", requireRole("student"), asyncHandler(getMyRemarks));
router.get("/class", requireRole("teacher", "admin"), asyncHandler(listRemarks));
router.post("/generate", requireRole("teacher", "admin"), asyncHandler(generateRemarks));
router.post("/release", requireRole("teacher", "admin"), asyncHandler(releaseRemarks));
router.put("/:id", requireRole("teacher", "admin"), asyncHandler(editRemark));

export default router;
