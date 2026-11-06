import test from "node:test";
import assert from "node:assert/strict";
import { isNearDuplicate, filterDuplicates } from "../src/services/questionDedupe";
import { buildVerifyPrompt, interpretVerification, shuffledOrders } from "../src/services/answerCheck";

const q = (text: string, correct = 1): any => ({
  type: "mcq", topic: "T", difficulty: "easy", questionText: text, marks: 1,
  options: ["alpha", "bravo", "charlie", "delta"].map((t, i) => ({ text: t, isCorrect: i === correct }))
});

// ---- duplicates
test("same wording with different case and punctuation is a duplicate", () => {
  assert.equal(isNearDuplicate("What is the capital of Nigeria?", "what is the capital of nigeria"), true);
});
test("near-identical wording with the same numbers is a duplicate", () => {
  assert.equal(isNearDuplicate("Find the perimeter of a rectangle 8 m long and 5 m wide.", "Find the perimeter of a rectangle that is 8 m long and 5 m wide."), true);
});
test("a changed number makes it a different question", () => {
  assert.equal(isNearDuplicate("What is 12 x 5?", "What is 12 x 6?"), false);
  assert.equal(isNearDuplicate("Find the perimeter of a rectangle 8 m long and 5 m wide.", "Find the perimeter of a rectangle 9 m long and 5 m wide."), false);
});
test("different topics are not duplicates", () => {
  assert.equal(isNearDuplicate("Name the organ that pumps blood.", "State two uses of water in the home."), false);
});
test("filterDuplicates drops repeats of the bank and repeats within the batch, keeping order", () => {
  const { kept, duplicates } = filterDuplicates(
    [q("Name the organ that pumps blood."), q("State two uses of water."), q("State two uses of water!"), q("Define a prime number.")],
    ["name the organ that pumps blood"]
  );
  assert.deepEqual(kept.map((k) => k.questionText), ["State two uses of water.", "Define a prime number."]);
  assert.equal(duplicates.length, 2);
});

// ---- second check
test("the checker never sees which option is marked correct", () => {
  const qs = [q("2+2?")];
  const prompt = buildVerifyPrompt(qs, [[0, 1, 2, 3]], { subjectName: "Maths", className: "P5" });
  assert.doesNotMatch(prompt, /isCorrect|correct answer is/i);
  assert.match(prompt, /A\. alpha/);
});
test("shuffledOrders is a permutation of each question's options", () => {
  const orders = shuffledOrders([q("a"), q("b")], () => 0.3);
  orders.forEach((o) => assert.deepEqual([...o].sort(), [0, 1, 2, 3]));
});
test("agreement is judged on the original option even when options were shuffled", () => {
  // shown order: bravo(1) first -> letter A means original index 1, which is the marked answer
  const out = interpretVerification({ results: [{ id: 1, answer: "A" }] }, [q("x", 1)], [[1, 0, 2, 3]]);
  assert.deepEqual(out, [{ status: "agreed" }]);
});
test("a different answer is flagged, naming both options and not letters", () => {
  const out = interpretVerification({ results: [{ id: 1, answer: "B", note: "Five is the sum." }] }, [q("x", 1)], [[1, 0, 2, 3]]);
  assert.equal(out[0]?.status, "disagreed");
  assert.match(out[0]!.note!, /chose “alpha” instead of “bravo”/);
  assert.match(out[0]!.note!, /Five is the sum\./);
});
test("none/multiple become 'unclear'; missing or garbage answers give no badge", () => {
  const qs = [q("a"), q("b"), q("c"), q("d")];
  const orders = qs.map(() => [0, 1, 2, 3]);
  const out = interpretVerification({ results: [{ id: 1, answer: "none" }, { id: 2, answer: "multiple" }, { id: 3, answer: "Z" }] }, qs, orders);
  assert.equal(out[0]?.status, "unclear");
  assert.equal(out[1]?.status, "unclear");
  assert.equal(out[2], null);
  assert.equal(out[3], null);
});
