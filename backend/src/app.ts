import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import questionRoutes from "./routes/questionRoutes";
import examRoutes from "./routes/examRoutes";
import attemptRoutes from "./routes/attemptRoutes";
import resultRoutes from "./routes/resultRoutes";
import userRoutes from "./routes/userRoutes";
import subjectRoutes from "./routes/subjectRoutes";
import classRoutes from "./routes/classRoutes";
import adminQuestionRoutes from "./routes/adminQuestionRoutes";
import adminExamRoutes from "./routes/adminExamRoutes";
import schoolRoutes from "./routes/schoolRoutes";
import gradingRoutes from "./routes/gradingRoutes";
import billingRoutes from "./routes/billingRoutes";
import { requireAuth } from "./middleware/auth";
import { requireRole } from "./middleware/requireRole";
import { requireActiveSubscription } from "./middleware/requireActiveSubscription";
import { errorHandler } from "./middleware/errorHandler";
import brandingRoutes from "./routes/brandingRoutes";
import { handleNombaWebhook } from "./controllers/nombaController";
import { asyncHandler } from "./middleware/asyncHandler";
import { activityLogger } from "./middleware/activityLogger";
import curriculumRoutes from "./routes/curriculumRoutes";
import activityRoutes from "./routes/activityRoutes";
import reviewRoutes from "./routes/reviewRoutes";

const app = express();
const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL
].filter((origin): origin is string => Boolean(origin));

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf.toString("utf8");
  }
}));

const v1 = express.Router();
v1.use(activityLogger);

v1.post("/webhooks/nomba", asyncHandler(handleNombaWebhook));

v1.use("/auth", authRoutes);

v1.use("/superadmin/schools", requireAuth, requireRole("superadmin"), schoolRoutes);

v1.use("/admin/branding", requireAuth, requireRole("admin"), brandingRoutes);
v1.use("/admin/billing", requireAuth, requireRole("admin"), billingRoutes); // never gated -- this is the way out
v1.use("/admin/classes", requireAuth, requireRole("admin"), requireActiveSubscription, classRoutes);
v1.use("/admin/subjects", requireAuth, requireRole("admin"), requireActiveSubscription, subjectRoutes);
v1.use("/admin/users", requireAuth, requireRole("admin"), requireActiveSubscription, userRoutes);
v1.use("/admin/questions", requireAuth, requireRole("admin"), requireActiveSubscription, adminQuestionRoutes);
v1.use("/admin/exams", requireAuth, requireRole("admin"), requireActiveSubscription, adminExamRoutes);
v1.use("/admin/curriculum", requireAuth, requireRole("admin"), requireActiveSubscription, curriculumRoutes);
v1.use("/admin/activity", requireAuth, requireRole("admin"), requireActiveSubscription, activityRoutes);
v1.use("/admin/review", requireAuth, requireRole("admin"), requireActiveSubscription, reviewRoutes);


v1.use("/teacher/branding", requireAuth, requireRole("teacher"), brandingRoutes);
v1.use("/teacher/classes", requireAuth, requireRole("teacher"), requireActiveSubscription, classRoutes);
v1.use("/teacher/subjects", requireAuth, requireRole("teacher"), requireActiveSubscription, subjectRoutes);
v1.use("/teacher/questions", requireAuth, requireRole("teacher"), requireActiveSubscription, questionRoutes);
v1.use("/teacher/curriculum", requireAuth, requireRole("teacher"), requireActiveSubscription, curriculumRoutes);
v1.use("/teacher/exams", requireAuth, requireRole("teacher"), requireActiveSubscription, examRoutes);
v1.use("/teacher/results", requireAuth, requireRole("teacher"), requireActiveSubscription, resultRoutes);
v1.use("/teacher/grading", requireAuth, requireRole("teacher"), requireActiveSubscription, gradingRoutes);


v1.use("/student/branding", requireAuth, requireRole("student"), brandingRoutes);
v1.use("/student/exams", requireAuth, requireRole("student"), examRoutes);
v1.use("/student/attempts", requireAuth, requireRole("student"), attemptRoutes);
v1.use("/student/results", requireAuth, requireRole("student"), resultRoutes);

app.use("/api/v1", v1);
app.get("/api/v1/health", (_req, res) => res.json({ status: "ok" }));

app.use(errorHandler);

export default app;