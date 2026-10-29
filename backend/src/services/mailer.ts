import axios from "axios";
import nodemailer, { Transporter } from "nodemailer";

// Two ways to send, picked by which settings exist (MAIL_FROM is always needed):
//   SMTP   -> SMTP_HOST + SMTP_USER + SMTP_PASS (+ SMTP_PORT, SMTP_SECURE)   e.g. Gmail, Brevo, Zoho
//   Resend -> RESEND_API_KEY                                                 (needs a verified domain)
// SMTP wins if both are set. With neither, email features say "not switched on".
export type MailProvider = "smtp" | "resend";

export function mailProvider(env: NodeJS.ProcessEnv = process.env): MailProvider | null {
  if (!env.MAIL_FROM) return null;
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) return "smtp";
  if (env.RESEND_API_KEY) return "resend";
  return null;
}

export function isMailConfigured(): boolean {
  return mailProvider() !== null;
}

let cachedTransport: Transporter | null = null;

function smtpTransport(): Transporter {
  if (cachedTransport) return cachedTransport;
  const port = Number(process.env.SMTP_PORT) || 587;
  // Port 465 is "SSL from the start"; 587 starts plain and upgrades (STARTTLS).
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000
  });
  return cachedTransport;
}

// Plain-English reason for a failure. Never includes the password, key or message body.
function explainSmtpError(err: any): string {
  if (err.code === "EAUTH" || err.responseCode === 535) return "SMTP login failed (check SMTP_USER and SMTP_PASS; Gmail needs an App Password)";
  if (err.code === "ECONNECTION" || err.code === "ESOCKET" || err.code === "ETIMEDOUT") return "could not reach the SMTP server (check SMTP_HOST, SMTP_PORT and SMTP_SECURE)";
  if (err.responseCode) return `the SMTP server refused the message (code ${err.responseCode})`;
  return err.code || "unknown error";
}

export async function sendMail(msg: { to: string; subject: string; text: string; html?: string }): Promise<void> {
  const provider = mailProvider();
  if (!provider) throw new Error("Email is not configured");

  if (provider === "smtp") {
    try {
      await smtpTransport().sendMail({ from: process.env.MAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
    } catch (err: any) {
      throw new Error(`Email not sent: ${explainSmtpError(err)}`);
    }
    return;
  }

  try {
    await axios.post(
      "https://api.resend.com/emails",
      { from: process.env.MAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html },
      { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, timeout: 10_000 }
    );
  } catch (err: any) {
    const detail = err.response?.data?.message || err.response?.status || err.code || "unknown error";
    throw new Error(`Email provider rejected the message: ${detail}`);
  }
}

// For the test script: checks the SMTP login without sending anything.
export async function verifyMail(): Promise<string> {
  const provider = mailProvider();
  if (!provider) throw new Error("Email is not configured (need MAIL_FROM plus SMTP_* or RESEND_API_KEY)");
  if (provider === "smtp") {
    try {
      await smtpTransport().verify();
    } catch (err: any) {
      throw new Error(`Email not working: ${explainSmtpError(err)}`);
    }
  }
  return provider;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
