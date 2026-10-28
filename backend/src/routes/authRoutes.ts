import { Router } from "express";
import { register, login, changeOwnPassword } from "../controllers/authController";
import { forgotPassword, resetPassword } from "../controllers/passwordResetController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireAuthAllowPasswordChange } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.post("/login", login);
router.post("/forgot-password", asyncHandler(forgotPassword));
router.post("/reset-password", asyncHandler(resetPassword));
// Only an existing admin can create new accounts. The very first admin
// comes from `npm run seed` (see backend/src/scripts/seed.ts).
router.post("/register", requireAuth, requireRole("admin"), register);
router.post("/change-password", requireAuthAllowPasswordChange, changeOwnPassword);

export default router;