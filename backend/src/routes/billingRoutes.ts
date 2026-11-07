import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { getAiUsage } from "../controllers/aiQuestionController";
import { asyncHandler } from "../middleware/asyncHandler";
import { getBillingStatus, getMyReceipt, emailMyReceipt } from "../controllers/schoolController";
import { initiatePayment } from "../controllers/nombaController";

const router = Router();
router.use(requireAuth, requireRole("admin"));

router.get("/status", asyncHandler(getBillingStatus));
router.get("/ai-usage", asyncHandler(getAiUsage));
router.get("/payments/:paymentId/receipt", asyncHandler(getMyReceipt));
router.post("/payments/:paymentId/email-receipt", asyncHandler(emailMyReceipt));
router.post("/pay", asyncHandler(initiatePayment));

export default router;