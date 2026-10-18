import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { bulkCreateUsers } from "../controllers/bulkUserController";
import { listUsers, deleteUser, resetUserPassword } from "../controllers/userController";

const router = Router();
router.use(requireAuth, requireRole("admin"));

router.get("/", asyncHandler(listUsers));
router.post("/bulk", asyncHandler(bulkCreateUsers));
router.delete("/:id", asyncHandler(deleteUser));
router.post("/:id/reset-password", asyncHandler(resetUserPassword));

export default router;