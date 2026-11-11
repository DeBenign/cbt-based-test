import { PASS_MARK, GOOD_MARK } from "./analytics";

export type Band = "good" | "pass" | "below" | null;

// Wording band for an average, using the same marks as the rest of the analytics.
export const bandOf = (average: number | null): Band =>
  average === null ? null : average >= GOOD_MARK ? "good" : average >= PASS_MARK ? "pass" : "below";

// Optional term window. `to` is a calendar day, so the whole of that day counts.
export function parsePeriod(from?: unknown, to?: unknown): { from: Date | null; to: Date | null; error?: string } {
  const parse = (v: unknown) => (typeof v === "string" && v.trim() ? new Date(`${v.trim()}T00:00:00.000Z`) : null);
  const f = parse(from);
  const t = parse(to);
  if ((f && isNaN(+f)) || (t && isNaN(+t))) return { from: null, to: null, error: "Dates must look like 2026-09-14." };
  if (f && t && +t < +f) return { from: null, to: null, error: "The end date is before the start date." };
  return { from: f, to: t ? new Date(+t + 24 * 60 * 60 * 1000) : null };
}

export const inPeriod = (when: Date | string, p: { from: Date | null; to: Date | null }) =>
  (!p.from || +new Date(when) >= +p.from) && (!p.to || +new Date(when) < +p.to);
