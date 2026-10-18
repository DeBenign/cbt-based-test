import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { createSchool, listSchools, setSchoolActive, recordPayment, setSchoolPricing } from "../controllers/schoolController";

const router = Router();
router.use(requireAuth);

router.get("/", requireRole("superadmin"), asyncHandler(listSchools));
router.post("/", requireRole("superadmin"), asyncHandler(createSchool));
router.put("/:id/active", requireRole("superadmin"), asyncHandler(setSchoolActive));
router.put("/:id/pricing", requireRole("superadmin"), asyncHandler(setSchoolPricing));
router.post("/:id/record-payment", requireRole("superadmin"), asyncHandler(recordPayment));

export default router;