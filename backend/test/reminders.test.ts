import test from "node:test";
import assert from "node:assert/strict";
import { pickReminder } from "../src/services/expiryReminders";

const end = new Date("2026-12-01T00:00:00Z");

test("nothing is sent while more than 14 days remain", () => {
  assert.equal(pickReminder("paid", end, 15, []), null);
});
test("14 days left sends the 14-day reminder", () => {
  assert.equal(pickReminder("paid", end, 14, [])?.threshold, 14);
});
test("a missed run still sends the closest reminder (5 days -> the 7-day one)", () => {
  assert.equal(pickReminder("trial", end, 5, [])?.threshold, 7);
});
test("the same reminder is never sent twice", () => {
  const first = pickReminder("paid", end, 7, [])!;
  assert.equal(pickReminder("paid", end, 6, [first.key]), null);
  assert.equal(pickReminder("paid", end, 3, [first.key])?.threshold, 3);
});
test("expiry day and the week after send the 'ended' notice once, then stop", () => {
  const ended = pickReminder("trial", end, 0, [])!;
  assert.equal(ended.threshold, 0);
  assert.equal(pickReminder("trial", end, -3, [ended.key]), null);
  assert.equal(pickReminder("trial", end, -8, []), null);
});
test("renewing (a new end date) starts a fresh reminder cycle", () => {
  const old = pickReminder("paid", end, 1, [])!;
  const renewed = new Date("2027-04-01T00:00:00Z");
  assert.notEqual(pickReminder("paid", renewed, 14, [old.key])?.key, old.key);
});
