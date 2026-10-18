import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { createClass, listClasses, deleteClass } from "../controllers/classController";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(listClasses));
router.post("/", requireRole("admin"), asyncHandler(createClass));
router.delete("/:id", requireRole("admin"), asyncHandler(deleteClass));

export default router;