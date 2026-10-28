import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { createSchool, listSchools, setSchoolActive, recordPayment, setSchoolPricing, listSchoolPayments, voidSchoolPayment, getSchoolReceipt } from "../controllers/schoolController";

const router = Router();
router.use(requireAuth);

router.get("/", requireRole("superadmin"), asyncHandler(listSchools));
router.post("/", requireRole("superadmin"), asyncHandler(createSchool));
router.put("/:id/active", requireRole("superadmin"), asyncHandler(setSchoolActive));
router.put("/:id/pricing", requireRole("superadmin"), asyncHandler(setSchoolPricing));
router.post("/:id/record-payment", requireRole("superadmin"), asyncHandler(recordPayment));

router.get("/:id/payments", requireRole("superadmin"), asyncHandler(listSchoolPayments));
router.post("/:id/payments/:paymentId/void", requireRole("superadmin"), asyncHandler(voidSchoolPayment));
router.get("/:id/payments/:paymentId/receipt", requireRole("superadmin"), asyncHandler(getSchoolReceipt));

export default router;