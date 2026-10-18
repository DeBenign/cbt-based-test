import { Router } from "express";
import { register, login, changeOwnPassword } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.post("/login", login);
// Only an existing admin can create new accounts. The very first admin
// comes from `npm run seed` (see backend/src/scripts/seed.ts).
router.post("/register", requireAuth, requireRole("admin"), register);
router.post("/change-password", requireAuth, changeOwnPassword);

export default router;