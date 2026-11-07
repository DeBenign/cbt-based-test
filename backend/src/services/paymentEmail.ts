import User from "../models/User";
import Payment from "../models/Payment";
import School from "../models/School";
import { isMailConfigured, sendMail, escapeHtml } from "./mailer";
import { isSyntheticEmail } from "../utils/passwordReset";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReceiptEmailInput {
  adminName: string;
  schoolName: string;
  receiptNo: string;
  amount: number;
  terms: number;
  termLabel?: string;
  method: "nomba" | "manual";
  paidUntil: Date;
  accessFrom?: Date;   // where the extension started; with paidUntil it gives "days added"
  frontendUrl: string;
}

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const lagosDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

// Pure, so the wording is testable without a database or a mail server.
export function buildReceiptEmail(i: ReceiptEmailInput, now = Date.now()): { subject: string; text: string; html: string } {
  const covers = `${i.terms} term${i.terms === 1 ? "" : "s"}${i.termLabel ? ` (${i.termLabel})` : ""}`;
  const how = i.method === "nomba" ? "Online payment (Nomba)" : "Payment recorded by Benchmark";
  const until = lagosDate(i.paidUntil);
  const daysLeft = Math.max(0, Math.ceil((i.paidUntil.getTime() - now) / DAY_MS));
  const added = i.accessFrom ? Math.round((i.paidUntil.getTime() - i.accessFrom.getTime()) / DAY_MS) : null;
  const addedLine = added ? `This payment added ${added} days of access. ` : "";
  const link = i.frontendUrl ? `${i.frontendUrl}/login` : "";
  const subject = `${i.schoolName}: payment received (receipt ${i.receiptNo})`;

  const text =
    `Hello ${i.adminName},\n\nThank you. We have received your payment for ${i.schoolName}.\n\n` +
    `Receipt number: ${i.receiptNo}\nAmount: ${naira(i.amount)}\nCovers: ${covers}\nMethod: ${how}\n` +
    `${addedLine}Your school's access now runs until ${until} (${daysLeft} day${daysLeft === 1 ? "" : "s"} from today).\n\n` +
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
    (added ? `<tr><td>Days added</td><td>${added} days</td></tr>` : "") +
    `<tr><td>Access runs until</td><td><b>${until}</b> (${daysLeft} day${daysLeft === 1 ? "" : "s"} from today)</td></tr></table>` +
    (link ? `<p>You can view and print this receipt any time: <a href="${link}">sign in and open Billing</a>.</p>` : "") +
    `<p>Please keep this email for your records.</p>`;

  return { subject, text, html };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("mail timed out")), ms))]);
}

export interface ReceiptEmailResult { sent: number; failed: number; skipped?: "mail-not-configured" | "no-admin-email" }

// Emails the school's admins who have a real address (or just one of them, when onlyUserId is given).
// Never throws: a mail problem must not undo or hide a payment that has already been recorded.
export async function sendPaymentReceipt(params: {
  schoolId: string;
  schoolName: string;
  receiptNo: string;
  amount: number;
  terms: number;
  termLabel?: string;
  method: "nomba" | "manual";
  paidUntil: Date;
  accessFrom?: Date;
  onlyUserId?: string;
}): Promise<ReceiptEmailResult> {
  try {
    if (!isMailConfigured()) return { sent: 0, failed: 0, skipped: "mail-not-configured" };

    const filter: Record<string, unknown> = { schoolId: params.schoolId, role: "admin" };
    if (params.onlyUserId) filter._id = params.onlyUserId;
    const admins = await User.find(filter).select("name email");
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

// Send (or re-send) the receipt for a payment that already exists.
export async function emailReceiptForPayment(
  schoolId: string, paymentId: string, onlyUserId?: string
): Promise<ReceiptEmailResult | { error: string; status: number }> {
  const [school, payment] = await Promise.all([School.findById(schoolId).select("name"), Payment.findOne({ _id: paymentId, schoolId })]);
  if (!school || !payment) return { error: "Receipt not found", status: 404 };
  if (payment.status === "voided") return { error: "This payment was cancelled, so there is no receipt to send.", status: 400 };
  if (!payment.paidUntilAfter || !payment.receiptNo) return { error: "This older payment has no receipt details to email. Open it once from Receipt first.", status: 400 };
  return sendPaymentReceipt({
    schoolId, schoolName: school.name, receiptNo: payment.receiptNo, amount: payment.amount, terms: payment.terms ?? 1,
    termLabel: payment.termLabel, method: payment.method, paidUntil: payment.paidUntilAfter, accessFrom: payment.accessFrom, onlyUserId
  });
}
