import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { AuthedRequest } from "../middleware/auth";
import School from "../models/School";
import { ensureTrialDates, getAccessStatus } from "../utils/schoolAccess";
import AuditLog from "../models/AuditLog";

// Only a logged-in admin can call this (see authRoutes.ts). schoolId always
// comes from the admin's own token, never from the request body, so an
// admin can only ever create users inside their own school.
export async function register(req: AuthedRequest, res: Response) {
  try {
    const { name, email, password, role, classId, subjectIds } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      schoolId: req.user!.schoolId,
      name,
      email,
      passwordHash,
      role,
      classId,
      subjectIds
    });

    return res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    return res.status(500).json({ error: "Registration failed" });
  }
}

export async function login(req: Request, res: Response) {
  try {
    // "identifier" is an email OR a username (bulk-created students have a
    // generated username and no real email). "email" is still accepted so
    // older clients keep working.
    const { identifier, email, password } = req.body;
    const loginId = String(identifier ?? email ?? "").trim().toLowerCase();
    if (!loginId || !password) return res.status(400).json({ error: "Enter your email or username and password." });
    const user = await User.findOne({ $or: [{ email: loginId }, { username: loginId }] });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    if (user.schoolId) {
      const school = await School.findById(user.schoolId);
      if (!school || !school.isActive) {
        return res.status(403).json({ error: "This school's account has been deactivated" });
      }

      await ensureTrialDates(school);
      const { trialActive, paidActive } = getAccessStatus(school);

      if (!trialActive && !paidActive && user.role !== "admin") {
        return res.status(403).json({ error: "This school's free trial has ended. Ask your school admin to renew access." });
      }
    }

    const token = jwt.sign(
      { userId: user._id, schoolId: user.schoolId, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" } as jwt.SignOptions
    );

    if (user.schoolId) {
      try {
        await AuditLog.create({
          schoolId: user.schoolId,
          actorId: user._id,
          actorRole: user.role,
          action: "auth.login",
          summary: "Signed in",
          entityType: "auth"
        });
      } catch (logErr) {
        console.error("audit log write failed", logErr);
      }
    }

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        classId: user.classId,
        subjectIds: user.subjectIds,
        mustChangePassword: !!user.mustChangePassword
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Login failed" });
  }
}

// Any logged-in role changes their own password, proving they know the
// current one. This is the only password-change path available to admin
// and superadmin accounts, since resetUserPassword deliberately excludes them.
export async function changeOwnPassword(req: AuthedRequest, res: Response) {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: "New password must be at least 4 characters." });
  }

  const user = await User.findById(req.user!.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect." });

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  await user.save();
  res.json({ message: "Password changed." });
}