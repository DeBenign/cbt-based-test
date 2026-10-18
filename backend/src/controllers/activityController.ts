import { Response } from "express";
import mongoose from "mongoose";
import { AuthedRequest } from "../middleware/auth";
import AuditLog from "../models/AuditLog";
import User from "../models/User";
import Class from "../models/Class";
import Subject from "../models/Subject";
import Question from "../models/Question";
import Exam from "../models/Exam";
import ExamAttempt from "../models/ExamAttempt";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pageParams(req: AuthedRequest, defaultLimit = 50) {
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

function serializeLog(l: any) {
  return {
    _id: l._id,
    createdAt: l.createdAt,
    action: l.action,
    summary: l.summary,
    entityType: l.entityType,
    entityId: l.entityId,
    meta: l.meta,
    actor: l.actorId ? { _id: l.actorId._id, name: l.actorId.name, role: l.actorId.role } : { name: "Deleted user", role: l.actorRole },
    target: l.targetUserId ? { _id: l.targetUserId._id, name: l.targetUserId.name } : null
  };
}

// School-wide activity feed, newest first, filterable by person, role, action text and date.
export async function getFeed(req: AuthedRequest, res: Response) {
  const { userId, role, q, from, to } = req.query;
  const { page, limit, skip } = pageParams(req);
  const filter: Record<string, any> = { schoolId: new mongoose.Types.ObjectId(req.user!.schoolId) };

  if (userId) {
    const uid = new mongoose.Types.ObjectId(String(userId));
    filter.$or = [{ actorId: uid }, { targetUserId: uid }];
  }
  if (role && ["admin", "teacher", "student"].includes(String(role))) filter.actorRole = role;
  if (q) filter.summary = new RegExp(escapeRegex(String(q)), "i");
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(String(from));
    if (to) filter.createdAt.$lte = new Date(String(to));
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("actorId", "name role")
      .populate("targetUserId", "name"),
    AuditLog.countDocuments(filter)
  ]);

  res.json({ items: items.map(serializeLog), total, page, pages: Math.ceil(total / limit) });
}

// Paged, searchable list of teachers and students with when each last did anything.
export async function listPeople(req: AuthedRequest, res: Response) {
  const { role, classId, q } = req.query;
  const { page, limit, skip } = pageParams(req);
  const filter: Record<string, any> = {
    schoolId: req.user!.schoolId,
    role: role === "teacher" || role === "student" ? role : { $in: ["teacher", "student"] }
  };
  if (classId) filter.classId = classId;
  if (q) {
    const rx = new RegExp(escapeRegex(String(q)), "i");
    filter.$or = [{ name: rx }, { username: rx }, { email: rx }];
  }

  const [users, total] = await Promise.all([
    User.find(filter).select("name username email role classId createdAt").sort({ name: 1 }).skip(skip).limit(limit),
    User.countDocuments(filter)
  ]);

  const ids = users.map((u) => u._id);
  const lastSeen = await AuditLog.aggregate([
    { $match: { schoolId: new mongoose.Types.ObjectId(req.user!.schoolId), actorId: { $in: ids } } },
    { $group: { _id: "$actorId", lastActiveAt: { $max: "$createdAt" }, actions: { $sum: 1 } } }
  ]);
  const seenById = new Map(lastSeen.map((r) => [r._id.toString(), r]));
  const classes = await Class.find({ schoolId: req.user!.schoolId }).select("name");
  const className = new Map(classes.map((c) => [c._id.toString(), c.name]));

  res.json({
    items: users.map((u) => ({
      _id: u._id,
      name: u.name,
      username: u.username,
      email: u.email,
      role: u.role,
      className: u.classId ? className.get(u.classId.toString()) : undefined,
      lastActiveAt: seenById.get(u._id.toString())?.lastActiveAt || null,
      actionCount: seenById.get(u._id.toString())?.actions || 0
    })),
    total,
    page,
    pages: Math.ceil(total / limit)
  });
}

// One person's full picture: profile, role-specific work, and their timeline.
export async function getUserActivity(req: AuthedRequest, res: Response) {
  const user = await User.findOne({ _id: req.params.userId, schoolId: req.user!.schoolId }).select("-passwordHash");
  if (!user) return res.status(404).json({ error: "User not found" });

  const uid = user._id;
  const sid = new mongoose.Types.ObjectId(req.user!.schoolId);
  const timeline = await AuditLog.find({ schoolId: sid, $or: [{ actorId: uid }, { targetUserId: uid }] })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("actorId", "name role")
    .populate("targetUserId", "name");

  const base: any = {
    user: {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      mustChangePassword: !!user.mustChangePassword,
      createdAt: user.createdAt
    },
    timeline: timeline.map(serializeLog)
  };

  if (user.role === "student") {
    const attempts = await ExamAttempt.find({ studentId: uid }).sort({ startedAt: -1 }).limit(50).populate("examId", "title");
    base.attempts = attempts.map((a) => ({
      _id: a._id,
      examTitle: (a.examId as any)?.title || "Deleted exam",
      status: a.status,
      score: a.score ?? null,
      needsGrading: a.needsGrading,
      flagCount: a.flaggedEvents.length,
      answered: a.answers.length,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt || null
    }));
  }

  if (user.role === "teacher") {
    const subjects = await Subject.find({ _id: { $in: user.subjectIds || [] } }).select("name");
    const [manual, ai, drafts, exams] = await Promise.all([
      Question.countDocuments({ createdBy: uid, source: { $ne: "ai" } }),
      Question.countDocuments({ createdBy: uid, source: "ai", reviewStatus: { $ne: "draft" } }),
      Question.countDocuments({ createdBy: uid, reviewStatus: "draft" }),
      Exam.find({ createdBy: uid }).sort({ startTime: -1 }).limit(30).select("title status startTime")
    ]);
    base.subjects = subjects.map((s) => s.name);
    base.questionStats = { manual, aiApproved: ai, aiDraftsPending: drafts };
    base.exams = exams;
  }

  res.json(base);
}
