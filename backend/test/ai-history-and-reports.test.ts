import test from "node:test";
import assert from "node:assert/strict";
import { summariseGeneration, validateReport } from "../src/services/aiHistory";

test("history: questions neither approved nor waiting count as discarded", () => {
  assert.deepEqual(summariseGeneration(10, { approved: 6, draft: 2 }), { approved: 6, draft: 2, discarded: 2 });
  assert.deepEqual(summariseGeneration(5, {}), { approved: 0, draft: 0, discarded: 5 });
  assert.deepEqual(summariseGeneration(3, { approved: 3 }), { approved: 3, draft: 0, discarded: 0 });
});
test("history: discarded is never negative", () => {
  assert.equal(summariseGeneration(2, { approved: 3 }).discarded, 0);
});

test("report: a known reason is accepted and the note is trimmed", () => {
  assert.deepEqual(validateReport({ reason: "wrong_answer", note: "  B is not right  " }), { ok: true, reason: "wrong_answer", note: "B is not right" });
});
test("report: unknown or missing reason is refused", () => {
  assert.equal(validateReport({ reason: "bad" }).ok, false);
  assert.equal(validateReport({}).ok, false);
});
test("report: 'other' needs a note, and notes are capped at 500 characters", () => {
  assert.equal(validateReport({ reason: "other" }).ok, false);
  assert.equal(validateReport({ reason: "other", note: "Unclear wording in part b" }).ok, true);
  assert.equal(validateReport({ reason: "unclear", note: "x".repeat(501) }).ok, false);
});
