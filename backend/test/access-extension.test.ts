import test from "node:test";
import assert from "node:assert/strict";
import { computeAccessEnd } from "../src/services/paymentService";
import { buildReceiptEmail } from "../src/services/paymentEmail";

const DAY = 86_400_000;
const now = Date.parse("2026-11-06T12:00:00Z");
const plus = (d: number) => new Date(now + d * DAY);

test("pay during the trial: the term is added AFTER the trial ends (82 days left + 120)", () => {
  const r = computeAccessEnd({ now, trialEndsAt: plus(82), paidUntil: null, terms: 1, termDays: 120 });
  assert.equal(r.from.getTime(), plus(82).getTime());
  assert.equal(r.until.getTime(), plus(202).getTime());
});
test("pay with the trial already over and nothing paid: the term starts today", () => {
  const r = computeAccessEnd({ now, trialEndsAt: plus(-10), paidUntil: null, terms: 1, termDays: 120 });
  assert.equal(r.from.getTime(), now);
  assert.equal(r.until.getTime(), plus(120).getTime());
});
test("pay again while paid time remains: it stacks on top, nothing is lost", () => {
  const r = computeAccessEnd({ now, trialEndsAt: plus(-30), paidUntil: plus(40), terms: 2, termDays: 120 });
  assert.equal(r.until.getTime(), plus(40 + 240).getTime());
});
test("an expired paid date never pulls the start back into the past", () => {
  const r = computeAccessEnd({ now, trialEndsAt: plus(-90), paidUntil: plus(-5), terms: 1, termDays: 90 });
  assert.equal(r.from.getTime(), now);
});
test("receipt email states days added and days left from today", () => {
  const m = buildReceiptEmail({
    adminName: "A", schoolName: "S", receiptNo: "R1", amount: 15000, terms: 1, method: "manual",
    paidUntil: plus(202), accessFrom: plus(82), frontendUrl: ""
  }, now);
  assert.match(m.text, /added 120 days of access/);
  assert.match(m.text, /\(202 days from today\)/);
  assert.match(m.html, /Days added/);
});
