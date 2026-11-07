import test from "node:test";
import assert from "node:assert/strict";
import { estimateCostUsd, monthWindow, effectiveLimit, remainingAllowance, limitMessage } from "../src/services/aiUsage";
import { checkDifficultyMix, validateQuestions } from "../src/services/questionGenerator";
import { buildReceiptEmail } from "../src/services/paymentEmail";

test("Haiku 5.5 cost: 8k tokens in + 4k out is a fraction of a cent", () => {
  const c = estimateCostUsd("claude-haiku-5-5", 8000, 4000);
  assert.ok(Math.abs(c - 0.0028) < 1e-9);
});
test("Sonnet 5.5 costs about 20x more for the same run", () => {
  const c = estimateCostUsd("claude-sonnet-5-5", 8000, 4000);
  assert.ok(Math.abs(c - 0.056) < 1e-9);
});
test("Haiku long prompts (over 100k tokens) use the higher rate", () => {
  assert.ok(estimateCostUsd("claude-haiku-5-5", 150_000, 1000) > 150_000 * 0.1 / 1e6 * 4);
});
test("an unknown model costs $0 unless prices are supplied by env", () => {
  assert.equal(estimateCostUsd("some-new-model", 1000, 1000, {} as any), 0);
  assert.equal(estimateCostUsd("some-new-model", 1_000_000, 1_000_000, { AI_PRICE_IN_PER_M: "1", AI_PRICE_OUT_PER_M: "2" } as any), 3);
});

test("the month runs on Nigeria time: 23:30 UTC on 31 Jan is already February", () => {
  const w = monthWindow(new Date("2026-01-31T23:30:00Z"));
  assert.equal(w.start.toISOString(), "2026-01-31T23:00:00.000Z");
  assert.equal(w.next.toISOString(), "2026-02-28T23:00:00.000Z");
});
test("limits: custom value wins, 0 is allowed, junk falls back to the default", () => {
  assert.equal(effectiveLimit(50), 50);
  assert.equal(effectiveLimit(0), 0);
  assert.equal(effectiveLimit(undefined), effectiveLimit(null));
  assert.equal(effectiveLimit(-5), effectiveLimit(undefined));
});
test("remaining allowance never goes below zero", () => {
  assert.equal(remainingAllowance(100, 40), 60);
  assert.equal(remainingAllowance(100, 130), 0);
});
test("limit message says when it resets", () => {
  assert.match(limitMessage(0, new Date("2026-11-30T23:00:00Z")), /resets on 1 December/);
  assert.match(limitMessage(3, new Date("2026-11-30T23:00:00Z")), /only 3 AI questions left/);
});

test("difficulty split must be whole numbers adding up to the total", () => {
  assert.deepEqual(checkDifficultyMix({ easy: 4, medium: 4, hard: 2 }, 10), { ok: true, mix: { easy: 4, medium: 4, hard: 2 } });
  assert.equal(checkDifficultyMix({ easy: 4, medium: 4, hard: 1 }, 10).ok, false);
  assert.equal(checkDifficultyMix({ easy: 2.5, medium: 2.5, hard: 5 }, 10).ok, false);
  assert.equal(checkDifficultyMix({ easy: -1, medium: 6, hard: 5 }, 10).ok, false);
});

test("validation still rejects a bad MCQ and keeps a good one", () => {
  const p: any = { topics: [{ title: "T", text: "x" }], mcqCount: 2, theoryCount: 0, theoryMarks: 5 };
  const good = { type: "mcq", topic: "T", difficulty: "easy", questionText: "2+2?", options: [{ text: "3" }, { text: "4", isCorrect: true }, { text: "5" }, { text: "6" }] };
  const bad = { ...good, questionText: "3+3?", options: [{ text: "5" }, { text: "6" }, { text: "7" }, { text: "8" }] };
  const r = validateQuestions({ questions: [good, bad] }, p);
  assert.equal(r.valid.length, 1);
  assert.equal(r.rejected, 1);
});

test("receipt email has the receipt number, amount, terms and access date", () => {
  const m = buildReceiptEmail({
    adminName: "Ada <b>", schoolName: "Test Academy", receiptNo: "BMK-2026-00007", amount: 45000, terms: 2,
    termLabel: "2026/27 Term 1", method: "manual", paidUntil: new Date("2027-03-31T12:00:00Z"), frontendUrl: "https://benchmarkcbt.vercel.app"
  });
  assert.equal(m.subject, "Test Academy: payment received (receipt BMK-2026-00007)");
  assert.match(m.text, /₦45,000/);
  assert.match(m.text, /2 terms \(2026\/27 Term 1\)/);
  assert.match(m.text, /runs until 31 March 2027/);
  assert.match(m.html, /Ada &lt;b&gt;/); // names are escaped
  assert.doesNotMatch(m.html, /Ada <b>/);
});
test("receipt email says Nomba for online payments and uses singular 'term'", () => {
  const m = buildReceiptEmail({ adminName: "A", schoolName: "S", receiptNo: "R", amount: 1, terms: 1, method: "nomba", paidUntil: new Date(), frontendUrl: "" });
  assert.match(m.text, /Online payment \(Nomba\)/);
  assert.match(m.text, /Covers: 1 term\n/);
  assert.doesNotMatch(m.text, /sign in and open Billing/);
});

test("with no mail server configured, the receipt step is skipped quietly and never throws", async () => {
  const saved = { ...process.env };
  for (const k of Object.keys(process.env)) if (/^(SMTP_|RESEND_|MAIL_)/.test(k)) delete process.env[k];
  try {
    const { sendPaymentReceipt } = await import("../src/services/paymentEmail");
    const r = await sendPaymentReceipt({ schoolId: "000000000000000000000000", schoolName: "S", receiptNo: "R", amount: 1, terms: 1, method: "manual", paidUntil: new Date() });
    assert.deepEqual(r, { sent: 0, failed: 0, skipped: "mail-not-configured" });
  } finally {
    Object.assign(process.env, saved);
  }
});
