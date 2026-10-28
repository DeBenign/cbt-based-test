import test from "node:test";
import assert from "node:assert/strict";
import { isValidCronAuth } from "../src/utils/cronAuth";

const SECRET = "a-long-enough-secret-123";

test("accepts the exact bearer secret", () => {
  assert.equal(isValidCronAuth(`Bearer ${SECRET}`, SECRET), true);
});
test("rejects wrong, missing and malformed headers", () => {
  assert.equal(isValidCronAuth("Bearer nope-nope-nope-nope", SECRET), false);
  assert.equal(isValidCronAuth(undefined, SECRET), false);
  assert.equal(isValidCronAuth(SECRET, SECRET), false); // no "Bearer " prefix
  assert.equal(isValidCronAuth(`Bearer ${SECRET}x`, SECRET), false);
});
test("refuses everything when the secret is unset or too short", () => {
  assert.equal(isValidCronAuth("Bearer ", ""), false);
  assert.equal(isValidCronAuth("Bearer abc", "abc"), false);
  assert.equal(isValidCronAuth(`Bearer ${SECRET}`, undefined), false);
});
