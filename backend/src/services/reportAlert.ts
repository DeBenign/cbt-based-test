import User from "../models/User";
import { isMailConfigured, sendMail, escapeHtml } from "./mailer";
import { isSyntheticEmail } from "../utils/passwordReset";

export interface WrongAnswerAlert {
  schoolName: string;
  teacherName: string;
  questionText: string;
  options: { text: string; isCorrect: boolean }[];
  note?: string;
  modelName?: string;
  aiCheck?: string;
  frontendUrl: string;
}

// Pure: the wording of the alert, testable without a mail server.
export function buildWrongAnswerAlert(a: WrongAnswerAlert): { subject: string; text: string; html: string } {
  const opts = a.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o.text}${o.isCorrect ? "  <- marked correct" : ""}`);
  const link = a.frontendUrl ? `${a.frontendUrl}/superadmin/ai-reports` : "";
  const check = a.aiCheck && a.aiCheck !== "agreed" ? `The AI's own second check flagged it too (${a.aiCheck}).` : a.aiCheck === "agreed" ? "The AI's second check had agreed with the marked answer." : "";
  const subject = `AI question reported as wrong: ${a.schoolName}`;

  const text =
    `${a.teacherName} at ${a.schoolName} says the marked answer to this AI question is wrong.\n\n` +
    `${a.questionText}\n${opts.join("\n")}\n\n` +
    (a.note ? `Teacher's note: ${a.note}\n` : "") +
    (a.modelName ? `Model: ${a.modelName}\n` : "") +
    (check ? `${check}\n` : "") +
    (link ? `\nReview and resolve: ${link}\n` : "");

  const html =
    `<p><b>${escapeHtml(a.teacherName)}</b> at <b>${escapeHtml(a.schoolName)}</b> says the marked answer to this AI question is wrong.</p>` +
    `<p>${escapeHtml(a.questionText)}</p><ul style="list-style:none;padding-left:0">` +
    a.options.map((o, i) => `<li>${String.fromCharCode(65 + i)}. ${escapeHtml(o.text)}${o.isCorrect ? " <b>(marked correct)</b>" : ""}</li>`).join("") +
    `</ul>` +
    (a.note ? `<p>Teacher's note: ${escapeHtml(a.note)}</p>` : "") +
    (a.modelName ? `<p>Model: ${escapeHtml(a.modelName)}</p>` : "") +
    (check ? `<p>${escapeHtml(check)}</p>` : "") +
    (link ? `<p><a href="${link}">Review and resolve</a></p>` : "");

  return { subject, text, html };
}

export async function alertRecipients(env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const fromEnv = (env.ALERT_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (fromEnv.length) return fromEnv;
  const owners = await User.find({ role: "superadmin" }).select("email");
  return owners.map((o) => o.email).filter((e) => e && !isSyntheticEmail(e));
}

// Best effort and never throws: a mail problem must not stop a teacher's report from being saved.
export async function notifyWrongAnswer(alert: Omit<WrongAnswerAlert, "frontendUrl">): Promise<{ sent: number }> {
  try {
    if (!isMailConfigured()) return { sent: 0 };
    const to = await alertRecipients();
    if (to.length === 0) return { sent: 0 };
    const mail = buildWrongAnswerAlert({ ...alert, frontendUrl: (process.env.FRONTEND_URL || "").replace(/\/+$/, "") });
    const results = await Promise.allSettled(to.map((addr) => sendMail({ to: addr, ...mail })));
    results.forEach((r) => { if (r.status === "rejected") console.error("wrong-answer alert failed", r.reason?.message); });
    return { sent: results.filter((r) => r.status === "fulfilled").length };
  } catch (err: any) {
    console.error("wrong-answer alert error", err?.message);
    return { sent: 0 };
  }
}
