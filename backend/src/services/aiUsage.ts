import { Types } from "mongoose";
import AiUsage from "../models/AiUsage";
import School from "../models/School";

// ---- price table (USD per million tokens) --------------------------------
// Check these against the pricing page when you change model. A model that is
// not listed is costed from AI_PRICE_IN_PER_M / AI_PRICE_OUT_PER_M if you set
// them, otherwise recorded as $0 (tokens are still counted).
const PRICES: Record<string, { in: number; out: number; inLong?: number; outLong?: number }> = {
  // Haiku 5.5 is dearer for prompts over 100k tokens; ours stay far below that.
  "claude-haiku-5-5": { in: 0.1, out: 0.5, inLong: 0.5, outLong: 2.5 },
  "claude-sonnet-5-5": { in: 2, out: 10 }
};
const LONG_PROMPT_TOKENS = 100_000;

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number, env = process.env): number {
  const p = PRICES[model];
  let rateIn: number | undefined;
  let rateOut: number | undefined;
  if (p) {
    const long = inputTokens > LONG_PROMPT_TOKENS && p.inLong !== undefined;
    rateIn = long ? p.inLong : p.in;
    rateOut = long ? p.outLong : p.out;
  } else if (env.AI_PRICE_IN_PER_M && env.AI_PRICE_OUT_PER_M) {
    rateIn = Number(env.AI_PRICE_IN_PER_M);
    rateOut = Number(env.AI_PRICE_OUT_PER_M);
  }
  if (!rateIn || !rateOut) return 0;
  return (inputTokens * rateIn + outputTokens * rateOut) / 1_000_000;
}

// ---- monthly allowance ----------------------------------------------------
// Unit = AI questions kept per calendar month (Nigeria time, UTC+1, no DST).
// Default for every school; the superadmin can override it per school.
export const DEFAULT_MONTHLY_LIMIT = Number(process.env.AI_MONTHLY_QUESTION_LIMIT) || 300;
const HOUR = 3_600_000;

export function monthWindow(now = new Date()): { start: Date; next: Date } {
  const lagos = new Date(now.getTime() + HOUR);
  const y = lagos.getUTCFullYear();
  const m = lagos.getUTCMonth();
  return { start: new Date(Date.UTC(y, m, 1) - HOUR), next: new Date(Date.UTC(y, m + 1, 1) - HOUR) };
}

export function effectiveLimit(override?: number | null): number {
  return typeof override === "number" && Number.isFinite(override) && override >= 0 ? Math.floor(override) : DEFAULT_MONTHLY_LIMIT;
}

export function remainingAllowance(limit: number, used: number): number {
  return Math.max(0, limit - used);
}

export interface MonthTotals { used: number; requests: number; inputTokens: number; outputTokens: number; costUsd: number }
const EMPTY: MonthTotals = { used: 0, requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };

function toTotals(r: any): MonthTotals {
  return { used: r.used, requests: r.requests, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUsd: r.costUsd };
}

const GROUP = {
  used: { $sum: "$saved" },
  requests: { $sum: 1 },
  inputTokens: { $sum: "$inputTokens" },
  outputTokens: { $sum: "$outputTokens" },
  costUsd: { $sum: "$costUsd" }
};

export async function getMonthTotals(schoolId: string | Types.ObjectId, now = new Date()): Promise<MonthTotals> {
  const { start, next } = monthWindow(now);
  const [row] = await AiUsage.aggregate([
    { $match: { schoolId: new Types.ObjectId(String(schoolId)), createdAt: { $gte: start, $lt: next } } },
    { $group: { _id: null, ...GROUP } }
  ]);
  return row ? toTotals(row) : { ...EMPTY };
}

// For the superadmin's schools list: one query for every school.
export async function getMonthTotalsBySchool(now = new Date()): Promise<Map<string, MonthTotals>> {
  const { start, next } = monthWindow(now);
  const rows = await AiUsage.aggregate([
    { $match: { createdAt: { $gte: start, $lt: next } } },
    { $group: { _id: "$schoolId", ...GROUP } }
  ]);
  return new Map(rows.map((r) => [String(r._id), toTotals(r)]));
}

export async function schoolAllowance(schoolId: string) {
  const [school, totals] = await Promise.all([School.findById(schoolId).select("aiMonthlyLimit"), getMonthTotals(schoolId)]);
  const limit = effectiveLimit(school?.aiMonthlyLimit);
  return { limit, used: totals.used, remaining: remainingAllowance(limit, totals.used), resetsOn: monthWindow().next };
}

// Never lets a bookkeeping failure throw away questions that were already generated.
export async function recordUsage(row: {
  schoolId: string; userId: string; curriculumId?: string; kind: "generate" | "regenerate";
  modelName: string; inputTokens: number; outputTokens: number; requested: number; saved: number; rejected: number;
}): Promise<void> {
  try {
    await AiUsage.create({ ...row, costUsd: estimateCostUsd(row.modelName, row.inputTokens, row.outputTokens) });
  } catch (err) {
    console.error("AI usage write failed", err);
  }
}

export function limitMessage(remaining: number, resetsOn: Date): string {
  const when = resetsOn.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Africa/Lagos" });
  return remaining === 0
    ? `Your school has used its AI question allowance for this month. It resets on ${when}. Ask your school admin or Benchmark if you need more.`
    : `Your school has only ${remaining} AI question${remaining === 1 ? "" : "s"} left this month (resets ${when}). Ask for fewer, or ask your school admin or Benchmark to raise the allowance.`;
}
