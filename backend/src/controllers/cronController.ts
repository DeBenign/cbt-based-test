import { Request, Response } from "express";
import { isValidCronAuth } from "../utils/cronAuth";
import { finalizeExpiredAttempts } from "../services/finalizeExpired";
import { sendExpiryReminders } from "../services/expiryReminders";

// Called on a schedule (see backend/vercel.json), not by a signed-in user.
export async function runMaintenance(req: Request, res: Response) {
  if (!process.env.CRON_SECRET) {
    return res.status(503).json({ error: "Scheduled jobs are not switched on (CRON_SECRET is not set)." });
  }
  if (!isValidCronAuth(req.headers.authorization, process.env.CRON_SECRET)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const report: Record<string, unknown> = {};

  try {
    report.attempts = await finalizeExpiredAttempts();
  } catch (err: any) {
    console.error("maintenance: sweep failed", err);
    report.attempts = { error: err.message || "failed" };
  }

  try {
    report.reminders = await sendExpiryReminders();
  } catch (err: any) {
    console.error("maintenance: reminders failed", err);
    report.reminders = { error: err.message || "failed" };
  }

  res.json({ ok: true, ranAt: new Date().toISOString(), ...report });
}
