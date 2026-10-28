import test from "node:test";
import assert from "node:assert/strict";
import { tokenPredatesPasswordChange } from "../src/utils/accountCheck";
import { checkVoidable } from "../src/services/paymentService";
import { formatReceiptNo } from "../src/utils/receipt";
import { isSyntheticEmail, hashToken, generateResetToken, resetLink } from "../src/utils/passwordReset";
import { takeSlots, checkLoginAllowed, recordLoginFailure, recordLoginSuccess, ThrottleStore } from "../src/services/authThrottle";

// --- forced password change / session retirement ---
test("a token signed before a password change is retired; one signed after is fine", () => {
  const changedAt = new Date(1_700_000_000_500); // mid-second
  assert.equal(tokenPredatesPasswordChange(1_699_999_999, changedAt), true);
  assert.equal(tokenPredatesPasswordChange(1_700_000_000, changedAt), false); // same second as the change
  assert.equal(tokenPredatesPasswordChange(1_700_000_100, changedAt), false);
  assert.equal(tokenPredatesPasswordChange(1_699_999_999, undefined), false);
});

// --- undoing payments ---
const until = new Date("2027-01-01T00:00:00Z");
const manual = { status: "applied" as const, method: "manual" as const, paidUntilAfter: until };

test("the newest manual payment can be undone", () => {
  assert.deepEqual(checkVoidable(manual, true, "BMK-2026-00002", until), { ok: true });
});
test("older, online, legacy, already-cancelled and out-of-sync payments are refused", () => {
  assert.equal(checkVoidable(manual, false, "BMK-2026-00009", until).ok, false);
  assert.equal(checkVoidable({ ...manual, method: "nomba" }, true, undefined, until).ok, false);
  assert.equal(checkVoidable({ ...manual, paidUntilAfter: undefined }, true, undefined, until).ok, false);
  assert.equal(checkVoidable({ ...manual, status: "voided" }, true, undefined, until).ok, false);
  assert.equal(checkVoidable(manual, true, undefined, new Date("2027-02-01T00:00:00Z")).ok, false);
});
test("older-payment refusal names the newer receipt", () => {
  const r = checkVoidable(manual, false, "BMK-2026-00009", until);
  assert.ok(!r.ok && r.error.includes("BMK-2026-00009"));
});
test("receipt numbers are zero-padded and per year", () => {
  assert.equal(formatReceiptNo("BMK", 2026, 7), "BMK-2026-00007");
  assert.equal(formatReceiptNo("BMK", 2027, 12345), "BMK-2027-12345");
});

// --- password reset helpers ---
test("reset tokens are random, hashed for storage, and hash deterministically", () => {
  const a = generateResetToken();
  const b = generateResetToken();
  assert.notEqual(a.token, b.token);
  assert.equal(a.token.length, 64);
  assert.equal(hashToken(a.token), a.hash);
  assert.notEqual(a.hash, a.token);
});
test("placeholder student emails are recognised; real ones are not", () => {
  assert.equal(isSyntheticEmail("ada.okafor@users.benchmark.local"), true);
  assert.equal(isSyntheticEmail("teacher@school.com"), false);
});
test("reset link tolerates a trailing slash", () => {
  assert.equal(resetLink("abc", "https://app.example.com/"), "https://app.example.com/reset-password?token=abc");
});

// --- throttling (in-memory store) ---
function memoryStore(): ThrottleStore {
  const rows = new Map<string, { count: number; expiresAt: number }>();
  return {
    async counts(keys, now) {
      const out: Record<string, { count: number; expiresAt: number }> = {};
      for (const k of keys) { const r = rows.get(k); if (r && r.expiresAt > now) out[k] = r; }
      return out;
    },
    async increment(key, now, windowMs) {
      const r = rows.get(key);
      if (!r || r.expiresAt <= now) rows.set(key, { count: 1, expiresAt: now + windowMs });
      else r.count++;
    },
    async clear(keys) { keys.forEach((k) => rows.delete(k)); }
  };
}

test("takeSlots allows up to the limit, then blocks, then frees after the window", async () => {
  const store = memoryStore();
  const rule = [{ key: "fp:id:ada", limit: 3 }];
  for (let i = 0; i < 3; i++) assert.equal((await takeSlots(store, rule, 1000)).allowed, true);
  const blocked = await takeSlots(store, rule, 2000);
  assert.equal(blocked.allowed, false);
  assert.equal((await takeSlots(store, rule, 1000 + 15 * 60 * 1000 + 1)).allowed, true);
});
test("login lockout after 5 failures from one device; success resets it", async () => {
  const store = memoryStore();
  for (let i = 0; i < 4; i++) await recordLoginFailure(store, "ada", "1.1.1.1", 1000);
  assert.equal((await checkLoginAllowed(store, "ada", "1.1.1.1", 1000)).allowed, true);
  await recordLoginSuccess(store, "ada", "1.1.1.1");
  for (let i = 0; i < 5; i++) await recordLoginFailure(store, "ada", "1.1.1.1", 1000);
  assert.equal((await checkLoginAllowed(store, "ada", "1.1.1.1", 1000)).allowed, false);
  assert.equal((await checkLoginAllowed(store, "ada", "2.2.2.2", 1000)).allowed, true); // another device
});
