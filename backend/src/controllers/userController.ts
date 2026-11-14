import { Response } from "express";
import bcrypt from "bcryptjs";
import { AuthedRequest } from "../middleware/auth";
import { clearAccountCache, forgetAccount } from "../utils/accountCheck";
import { MIN_PASSWORD_LENGTH } from "../utils/password";
import mongoose from "mongoose";
import User from "../models/User";
import Subject from "../models/Subject";
import Class from "../models/Class";
import { forgetTeacherScope } from "../utils/teacherScope";
import { logActivity } from "../utils/activity";

export async function listUsers(req: AuthedRequest, res: Response) {
  const { role, classId, q } = req.query;
  const filter: Record<string, unknown> = { schoolId: req.user!.schoolId };
  if (role) filter.role = role;
  if (classId) filter.classId = classId;
  if (q) {
    const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { username: rx }, { email: rx }];
  }

  // Without ?page= this returns the whole list (what older clients expect).
  // With it, results are paged so large schools don't load thousands of rows.
  if (req.query.page === undefined) {
    const users = await User.find(filter).select("-passwordHash").sort({ createdAt: -1 });
    return res.json(users);
  }

  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 25));
  const [items, total] = await Promise.all([
    User.find(filter).select("-passwordHash").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter)
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

export async function deleteUser(req: AuthedRequest, res: Response) {
  const user = await User.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.role === "admin") {
    return res.status(400).json({ error: "Admin accounts can't be deleted here" });
  }
  await user.deleteOne();
  clearAccountCache();
  res.status(204).send();
}

// Admin resets a teacher/student's password to a new temporary one, the
// same way account creation already works -- admin types it, shares it
// directly. Admin passwords are excluded here on purpose: resetting your
// own colleague's login without their knowledge is a different trust
// situation than resetting a student's, so an admin uses changeOwnPassword
// (in authController) for their own account instead.
export async function resetUserPassword(req: AuthedRequest, res: Response) {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }

  const user = await User.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.role === "admin") {
    return res.status(400).json({ error: "Admin passwords can't be reset here." });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = true; // it's a temporary password the admin knows
  user.passwordChangedAt = new Date(); // any session already open with the old password ends
  await user.save();
  forgetAccount(String(user._id));
  res.json({ message: `Password reset for ${user.email}.` });
}

// PUT /users/:id/assignments  { subjectIds, classIds }
// Sets which subjects and classes a teacher works in. A teacher can only see and change
// questions, exams, results and analytics for a subject AND class assigned here.
export async function updateTeacherAssignments(req: AuthedRequest, res: Response) {
  const { subjectIds, classIds } = req.body as { subjectIds?: string[]; classIds?: string[] };
  if (!Array.isArray(subjectIds) || !Array.isArray(classIds)) {
    return res.status(400).json({ error: "Send both subjectIds and classIds (either can be empty)." });
  }
  if (![...subjectIds, ...classIds].every((id) => mongoose.isValidObjectId(id))) {
    return res.status(400).json({ error: "Invalid subject or class." });
  }

  const schoolId = req.user!.schoolId;
  const teacher = await User.findOne({ _id: req.params.id, schoolId, role: "teacher" });
  if (!teacher) return res.status(404).json({ error: "Teacher not found." });

  const uniqueSubjects = [...new Set(subjectIds)];
  const uniqueClasses = [...new Set(classIds)];
  const [subjectCount, classCount] = await Promise.all([
    Subject.countDocuments({ _id: { $in: uniqueSubjects }, schoolId }),
    Class.countDocuments({ _id: { $in: uniqueClasses }, schoolId })
  ]);
  if (subjectCount !== uniqueSubjects.length || classCount !== uniqueClasses.length) {
    return res.status(400).json({ error: "Some of those subjects or classes aren't in your school." });
  }

  teacher.subjectIds = uniqueSubjects as any;
  teacher.classIds = uniqueClasses as any;
  await teacher.save();
  forgetTeacherScope(String(teacher._id));

  await logActivity(req, {
    action: "users.assign",
    summary: `Updated ${teacher.name}'s subjects and classes`,
    entityType: "user",
    entityId: String(teacher._id),
    meta: { subjects: uniqueSubjects.length, classes: uniqueClasses.length }
  });

  res.json({ _id: teacher._id, subjectIds: teacher.subjectIds, classIds: teacher.classIds });
}
