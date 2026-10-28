import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User";
import School from "../models/School";
import PasswordReset from "../models/PasswordReset";
import AuditLog from "../models/AuditLog";
import { isMailConfigured, sendMail, escapeHtml } from "../services/mailer";
import { mongoThrottleStore, takeSlots } from "../services/authThrottle";
import { generateResetToken, hashToken, isSyntheticEmail, resetLink, RESET_TTL_MS } from "../utils/passwordReset";
import { MIN_PASSWORD_LENGTH } from "../utils/password";
import { forgetAccount } from "../utils/accountCheck";

const SAME_ANSWER = "If that account has an email address on file, we've sent a link to reset the password. It works for 30 minutes.";

// POST /auth/forgot-password  { identifier }   (email or username)
// Always answers the same way whether or not the account exists.
export async function forgotPassword(req: Request, res: Response) {
  if (!isMailConfigured()) {
    return res.status(503).json({ error: "Resetting by email isn't switched on yet. Please ask your school admin to reset your password." });
  }

  const loginId = String(req.body?.identifier ?? "").trim().toLowerCase().slice(0, 200);
  if (!loginId) return res.status(400).json({ error: "Enter your email or username." });

  const ip = req.ip || "unknown";
  const gate = await takeSlots(mongoThrottleStore, [
    { key: `fp:id:${loginId}`, limit: 3 },
    { key: `fp:ip:${ip}`, limit: 20 }
  ]);
  if (!gate.allowed) {
    res.set("Retry-After", String(gate.retryAfterSec));
    return res.status(429).json({ error: "Too many requests. Please try again in a few minutes." });
  }

  try {
    const user = await User.findOne({ $or: [{ email: loginId }, { username: loginId }] });
    if (user && !isSyntheticEmail(user.email)) {
      let schoolOk = true;
      if (user.schoolId) {
        const school = await School.findById(user.schoolId).select("isActive");
        schoolOk = !!school && school.isActive;
      }
      if (schoolOk) {
        await PasswordReset.deleteMany({ userId: user._id }); // only the newest link works
        const { token, hash } = generateResetToken();
        await PasswordReset.create({ userId: user._id, tokenHash: hash, expiresAt: new Date(Date.now() + RESET_TTL_MS) });

        const link = resetLink(token);
        const name = escapeHtml(user.name);
        await sendMail({
          to: user.email,
          subject: "Reset your password",
          text: `Hello ${user.name},\n\nUse this link to choose a new password (valid for 30 minutes):\n${link}\n\nIf you didn't ask for this, ignore this email — your password stays the same.`,
          html: `<p>Hello ${name},</p><p><a href="${link}">Choose a new password</a> (valid for 30 minutes).</p><p>If you didn't ask for this, ignore this email — your password stays the same.</p>`
        });
      }
    }
  } catch (err) {
    // Logged for us, invisible to the caller (so the answer can't reveal anything).
    console.error("forgot-password: could not send reset email", err);
  }

  res.json({ message: SAME_ANSWER });
}

// POST /auth/reset-password  { token, newPassword }
export async function resetPassword(req: Request, res: Response) {
  const token = String(req.body?.token ?? "");
  const newPassword = String(req.body?.newPassword ?? "");

  const gate = await takeSlots(mongoThrottleStore, [{ key: `rp:ip:${req.ip || "unknown"}`, limit: 30 }]);
  if (!gate.allowed) {
    res.set("Retry-After", String(gate.retryAfterSec));
    return res.status(429).json({ error: "Too many attempts. Please try again in a few minutes." });
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }
  const invalid = () => res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
  if (!token) return invalid();

  // Single-use: the claim is one atomic update, so a link can't be spent twice.
  const claimed = await PasswordReset.findOneAndUpdate(
    { tokenHash: hashToken(token), usedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } }
  );
  if (!claimed) return invalid();

  const user = await User.findById(claimed.userId);
  if (!user) return invalid();

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date(); // every existing session ends
  await user.save();
  forgetAccount(String(user._id));
  await PasswordReset.deleteMany({ userId: user._id });

  if (user.schoolId) {
    try {
      await AuditLog.create({
        schoolId: user.schoolId, actorId: user._id, actorRole: user.role,
        action: "auth.password_reset", summary: "Reset their own password using an emailed link", entityType: "auth"
      });
    } catch (err) { console.error("audit log write failed", err); }
  }

  // Tell the owner it happened (best effort).
  if (!isSyntheticEmail(user.email)) {
    sendMail({
      to: user.email,
      subject: "Your password was changed",
      text: `Hello ${user.name},\n\nYour password was just changed using a reset link. If this wasn't you, contact your school admin right away.`
    }).catch((err) => console.error("password-changed email failed", err));
  }

  res.json({ message: "Password changed. You can sign in now." });
}
