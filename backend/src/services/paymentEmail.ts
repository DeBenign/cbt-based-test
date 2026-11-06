import User from "../models/User";
import { isMailConfigured, sendMail, escapeHtml } from "./mailer";
import { isSyntheticEmail } from "../utils/passwordReset";

export interface ReceiptEmailInput {
  adminName: string;
  schoolName: string;
  receiptNo: string;
  amount: number;
  terms: number;
  termLabel?: string;
  method: "nomba" | "manual";
  paidUntil: Date;
  frontendUrl: string;
}

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const lagosDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

// Pure, so the wording is testable without a database or a mail server.
export function buildReceiptEmail(i: ReceiptEmailInput): { subject: string; text: string; html: string } {
  const covers = `${i.terms} term${i.terms === 1 ? "" : "s"}${i.termLabel ? ` (${i.termLabel})` : ""}`;
  const how = i.method === "nomba" ? "Online payment (Nomba)" : "Payment recorded by Benchmark";
  const until = lagosDate(i.paidUntil);
  const link = i.frontendUrl ? `${i.frontendUrl}/login` : "";
  const subject = `${i.schoolName}: payment received (receipt ${i.receiptNo})`;

  const text =
    `Hello ${i.adminName},\n\nThank you. We have received your payment for ${i.schoolName}.\n\n` +
    `Receipt number: ${i.receiptNo}\nAmount: ${naira(i.amount)}\nCovers: ${covers}\nMethod: ${how}\n` +
    `Your school's access is now paid until ${until}.\n\n` +
    (link ? `You can view and print this receipt any time: sign in and open Billing. ${link}\n\n` : "") +
    `Please keep this email for your records.\n`;

  const html =
    `<p>Hello ${escapeHtml(i.adminName)},</p>` +
    `<p>Thank you. We have received your payment for <b>${escapeHtml(i.schoolName)}</b>.</p>` +
    `<table cellpadding="6" style="border-collapse:collapse">` +
    `<tr><td>Receipt number</td><td><b>${escapeHtml(i.receiptNo)}</b></td></tr>` +
    `<tr><td>Amount</td><td><b>${naira(i.amount)}</b></td></tr>` +
    `<tr><td>Covers</td><td>${escapeHtml(covers)}</td></tr>` +
    `<tr><td>Method</td><td>${how}</td></tr>` +
    `<tr><td>Access paid until</td><td><b>${until}</b></td></tr></table>` +
    (link ? `<p>You can view and print this receipt any time: <a href="${link}">sign in and open Billing</a>.</p>` : "") +
    `<p>Please keep this email for your records.</p>`;

  return { subject, text, html };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("mail timed out")), ms))]);
}

// Emails every school admin who has a real address. Never throws: a mail problem
// must not undo or hide a payment that has already been recorded.
export async function sendPaymentReceipt(params: {
  schoolId: string;
  schoolName: string;
  receiptNo: string;
  amount: number;
  terms: number;
  termLabel?: string;
  method: "nomba" | "manual";
  paidUntil: Date;
}): Promise<{ sent: number; failed: number; skipped?: "mail-not-configured" | "no-admin-email" }> {
  try {
    if (!isMailConfigured()) return { sent: 0, failed: 0, skipped: "mail-not-configured" };

    const admins = await User.find({ schoolId: params.schoolId, role: "admin" }).select("name email");
    const recipients = admins.filter((a) => !isSyntheticEmail(a.email));
    if (recipients.length === 0) return { sent: 0, failed: 0, skipped: "no-admin-email" };

    const frontendUrl = (process.env.FRONTEND_URL || "").replace(/\/+$/, "");
    const results = await Promise.allSettled(
      recipients.map((a) => {
        const mail = buildReceiptEmail({ ...params, adminName: a.name, frontendUrl });
        return withTimeout(sendMail({ to: a.email, ...mail }), 8000);
      })
    );
    results.forEach((r) => { if (r.status === "rejected") console.error("receipt email failed", r.reason?.message); });
    const sent = results.filter((r) => r.status === "fulfilled").length;
    return { sent, failed: results.length - sent };
  } catch (err: any) {
    console.error("receipt email error", err?.message);
    return { sent: 0, failed: 1 };
  }
}
