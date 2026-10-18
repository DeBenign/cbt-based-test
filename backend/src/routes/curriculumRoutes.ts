import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../middleware/asyncHandler";
import { uploadCurriculum, listCurricula, deleteCurriculum } from "../controllers/curriculumController";

// 4 MB: Vercel serverless functions reject request bodies over ~4.5 MB.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

// Mounted twice in app.ts (/admin/curriculum and /teacher/curriculum); auth and
// role checks happen at the mount, per-subject checks in the controller.
const router = Router();
router.get("/", asyncHandler(listCurricula));
router.post("/", upload.single("file"), asyncHandler(uploadCurriculum));
router.delete("/:id", asyncHandler(deleteCurriculum));

export default router;
