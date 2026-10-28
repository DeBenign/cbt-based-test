import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User";
import { AuthedRequest } from "../middleware/auth";
import School from "../models/School";
import { ensureTrialDates, getAccessStatus } from "../utils/schoolAccess";
import AuditLog from "../models/AuditLog";
import { MIN_PASSWORD_LENGTH, signToken } from "../utils/password";
import { forgetAccount } from "../utils/accountCheck";
import { mongoThrottleStore, checkLoginAllowed, recordLoginFailure, recordLoginSuccess } from "../services/authThrottle";

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

    // Slow down password guessing: refuse before even checking the password
    // once too many recent attempts have failed.
    const ip = req.ip || "unknown";
    const gate = await checkLoginAllowed(mongoThrottleStore, loginId, ip);
    if (!gate.allowed) {
      res.set("Retry-After", String(gate.retryAfterSec));
      const minutes = Math.max(1, Math.ceil(gate.retryAfterSec / 60));
      return res.status(429).json({ error: `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` });
    }

    const user = await User.findOne({ $or: [{ email: loginId }, { username: loginId }] });
    if (!user) {
      await recordLoginFailure(mongoThrottleStore, loginId, ip);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await recordLoginFailure(mongoThrottleStore, loginId, ip);
      return res.status(401).json({ error: "Invalid credentials" });
    }
    await recordLoginSuccess(mongoThrottleStore, loginId, ip);

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

    const token = signToken(user);

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
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }

  const user = await User.findById(req.user!.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect." });

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date(); // signs this person out on every other device
  await user.save();
  forgetAccount(String(user._id));
  // Hand back a fresh token: the one used for this request predates the change.
  res.json({ message: "Password changed.", token: signToken(user) });
}