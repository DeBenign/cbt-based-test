import { REPORT_REASONS, ReportReason } from "../models/QuestionReport";

// How many of a run's questions are still waiting, were approved, or are gone (discarded or regenerated away).
export function summariseGeneration(saved: number, counts: { approved?: number; draft?: number }) {
  const approved = counts.approved ?? 0;
  const draft = counts.draft ?? 0;
  return { approved, draft, discarded: Math.max(0, saved - approved - draft) };
}

export function validateReport(body: any): { ok: true; reason: ReportReason; note: string } | { ok: false; error: string } {
  if (!REPORT_REASONS.includes(body?.reason)) return { ok: false, error: "Choose what is wrong with the question." };
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (note.length > 500) return { ok: false, error: "Keep the note under 500 characters." };
  if (body.reason === "other" && note.length === 0) return { ok: false, error: "Add a short note saying what is wrong." };
  return { ok: true, reason: body.reason, note };
}
