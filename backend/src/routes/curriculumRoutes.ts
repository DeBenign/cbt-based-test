import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireRole } from "../middleware/requireRole";
import { uploadCurriculum, listCurricula, deleteCurriculum } from "../controllers/curriculumController";

// 4 MB: Vercel serverless functions reject request bodies over ~4.5 MB.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

// Mounted twice in app.ts (/admin/curriculum and /teacher/curriculum). Admins can read
// the school's curricula (oversight); only teachers can upload or delete them.
const router = Router();
router.get("/", asyncHandler(listCurricula));
router.post("/", requireRole("teacher"), upload.single("file"), asyncHandler(uploadCurriculum));
router.delete("/:id", requireRole("teacher"), asyncHandler(deleteCurriculum));

export default router;
