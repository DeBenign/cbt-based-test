import { Response } from "express";
import bcrypt from "bcryptjs";
import { AuthedRequest } from "../middleware/auth";
import User from "../models/User";

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
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: "New password must be at least 4 characters." });
  }

  const user = await User.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.role === "admin") {
    return res.status(400).json({ error: "Admin passwords can't be reset here." });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = true; // it's a temporary password the admin knows
  await user.save();
  res.json({ message: `Password reset for ${user.email}.` });
}