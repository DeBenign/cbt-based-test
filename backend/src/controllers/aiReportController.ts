import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import QuestionReport from "../models/QuestionReport";
import School from "../models/School";
import User from "../models/User";

// Superadmin: what teachers say is wrong with AI questions, so prompts and the model choice can be judged on evidence.
export async function listAiReports(req: AuthedRequest, res: Response) {
  const status = req.query.status === "resolved" ? "resolved" : "open";
  const rows = await QuestionReport.find({ status }).sort({ createdAt: -1 }).limit(200).lean();

  const [schools, users] = await Promise.all([
    School.find({ _id: { $in: rows.map((r) => r.schoolId) } }).select("name").lean(),
    User.find({ _id: { $in: rows.map((r) => r.reporterId) } }).select("name").lean()
  ]);
  const schoolName = new Map(schools.map((s) => [String(s._id), s.name]));
  const userName = new Map(users.map((u) => [String(u._id), u.name]));

  const byReason: Record<string, number> = {};
  const byModel: Record<string, number> = {};
  for (const r of rows) {
    byReason[r.reason] = (byReason[r.reason] || 0) + 1;
    const m = r.modelName || "unknown";
    byModel[m] = (byModel[m] || 0) + 1;
  }

  res.json({
    status,
    total: rows.length,
    byReason,
    byModel,
    reports: rows.map((r) => ({
      id: r._id,
      createdAt: r.createdAt,
      schoolName: schoolName.get(String(r.schoolId)) || "Unknown school",
      teacherName: userName.get(String(r.reporterId)) || "Unknown teacher",
      reason: r.reason,
      note: r.note,
      modelName: r.modelName,
      snapshot: r.snapshot,
      status: r.status
    }))
  });
}

export async function resolveAiReport(req: AuthedRequest, res: Response) {
  const report = await QuestionReport.findOneAndUpdate(
    { _id: req.params.id, status: "open" },
    { $set: { status: "resolved", resolvedAt: new Date(), resolvedBy: req.user!.userId } },
    { new: true }
  );
  if (!report) return res.status(404).json({ error: "Open report not found." });
  res.json({ resolved: true });
}
