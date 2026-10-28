import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { getBillingStatus, getMyReceipt } from "../controllers/schoolController";
import { initiatePayment } from "../controllers/nombaController";

const router = Router();
router.use(requireAuth, requireRole("admin"));

router.get("/status", asyncHandler(getBillingStatus));
router.get("/payments/:paymentId/receipt", asyncHandler(getMyReceipt));
router.post("/pay", asyncHandler(initiatePayment));

export default router;