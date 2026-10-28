import axios from "axios";

// Sends through Resend's HTTP API (works on Vercel serverless; no SMTP socket needed).
// Switched on by RESEND_API_KEY + MAIL_FROM. Without them, features that need
// email say so clearly instead of pretending to work.
export function isMailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM;
}

export async function sendMail(msg: { to: string; subject: string; text: string; html?: string }): Promise<void> {
  if (!isMailConfigured()) throw new Error("Email is not configured");
  try {
    await axios.post(
      "https://api.resend.com/emails",
      { from: process.env.MAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html },
      { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, timeout: 10_000 }
    );
  } catch (err: any) {
    // Never include the request (it holds the key and the message body).
    const detail = err.response?.data?.message || err.response?.status || err.code || "unknown error";
    throw new Error(`Email provider rejected the message: ${detail}`);
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
