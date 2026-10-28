import School from "../models/School";
import User from "../models/User";
import { accessExpiry } from "../utils/schoolAccess";
import { termFee } from "../utils/billingConfig";
import { isMailConfigured, sendMail, escapeHtml } from "./mailer";
import { isSyntheticEmail } from "../utils/passwordReset";

// Days before the end of access at which a reminder goes out. 0 = "has ended".
export const REMINDER_THRESHOLDS = [14, 7, 3, 1, 0];
// After this many days past the end, stop nagging.
export const STOP_AFTER_DAYS = 7;

export interface ReminderChoice {
  key: string;        // remembered on the school so the same reminder is never sent twice
  threshold: number;
  daysLeft: number;
}

// Pure: decides whether a school is due a reminder right now.
// Picks the closest threshold at or above the days left, so a missed day
// (cron down, or a school created late in the window) still gets one reminder.
export function pickReminder(
  kind: "paid" | "trial",
  endsAt: Date,
  daysLeft: number,
  alreadySent: string[]
): ReminderChoice | null {
  if (daysLeft > REMINDER_THRESHOLDS[0]) return null;
  if (daysLeft < -STOP_AFTER_DAYS) return null;
  const clamped = Math.max(0, daysLeft);
  const threshold = Math.min(...REMINDER_THRESHOLDS.filter((t) => t >= clamped));
  const key = `${kind}:${endsAt.toISOString().slice(0, 10)}:${threshold}`;
  return alreadySent.includes(key) ? null : { key, threshold, daysLeft };
}

function describeWhen(daysLeft: number): string {
  if (daysLeft <= 0) return "has ended";
  if (daysLeft === 1) return "ends tomorrow";
  return `ends in ${daysLeft} days`;
}

export interface ReminderReport {
  skipped?: "mail-not-configured";
  schoolsChecked: number;
  emailsSent: number;
  emailsFailed: number;
}

export async function sendExpiryReminders(now = Date.now()): Promise<ReminderReport> {
  if (!isMailConfigured()) return { skipped: "mail-not-configured", schoolsChecked: 0, emailsSent: 0, emailsFailed: 0 };

  const frontend = (process.env.FRONTEND_URL || "").replace(/\/+$/, "");
  const schools = await School.find({ isActive: true });
  const report: ReminderReport = { schoolsChecked: schools.length, emailsSent: 0, emailsFailed: 0 };

  for (const school of schools) {
    const { kind, endsAt, daysLeft } = accessExpiry(school, now);
    const choice = pickReminder(kind, endsAt, daysLeft, school.reminderKeysSent || []);
    if (!choice) continue;

    const admins = await User.find({ schoolId: school._id, role: "admin" }).select("name email");
    const recipients = admins.filter((a) => !isSyntheticEmail(a.email));
    if (recipients.length === 0) continue;

    const studentCount = await User.countDocuments({ schoolId: school._id, role: "student" });
    const fee = termFee(studentCount, school.pricePerStudent);
    const what = kind === "paid" ? "subscription" : "free trial";
    const when = describeWhen(choice.daysLeft);
    const endDate = endsAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
    const consequence = choice.daysLeft <= 0
      ? "Teachers and students can no longer sign in until a payment is recorded."
      : "When it ends, teachers and students can't sign in until a payment is recorded.";

    const subject = choice.daysLeft <= 0
      ? `${school.name}: your ${what} has ended`
      : `${school.name}: your ${what} ${when}`;

    const results = await Promise.allSettled(
      recipients.map((a) =>
        sendMail({
          to: a.email,
          subject,
          text:
            `Hello ${a.name},\n\nYour school's ${what} for ${school.name} ${when} (${endDate}). ${consequence}\n\n` +
            `Current fee per term: ₦${fee.toLocaleString()} (${studentCount} student account${studentCount === 1 ? "" : "s"}).\n` +
            `Sign in and open Billing to see how to pay: ${frontend}/login\n`,
          html:
            `<p>Hello ${escapeHtml(a.name)},</p>` +
            `<p>Your school's ${what} for <b>${escapeHtml(school.name)}</b> ${when} (${endDate}). ${consequence}</p>` +
            `<p>Current fee per term: <b>₦${fee.toLocaleString()}</b> (${studentCount} student account${studentCount === 1 ? "" : "s"}).</p>` +
            `<p><a href="${frontend}/login">Sign in and open Billing</a> to see how to pay.</p>`
        })
      )
    );

    const ok = results.filter((r) => r.status === "fulfilled").length;
    report.emailsSent += ok;
    report.emailsFailed += results.length - ok;
    results.forEach((r) => { if (r.status === "rejected") console.error("reminder email failed", r.reason?.message); });

    // Remember it only if someone actually received it, so a failure is retried next run.
    if (ok > 0) {
      await School.updateOne({ _id: school._id }, { $push: { reminderKeysSent: { $each: [choice.key], $slice: -20 } } });
    }
  }
  return report;
}
