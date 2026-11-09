import test from "node:test";
import assert from "node:assert/strict";
import { summariseStudent, trendOf, histogram, mostMissed, topicAccuracy, pct, ExamPoint } from "../src/services/analytics";

const sat = (...v: number[]): ExamPoint[] => v.map((p) => ({ pct: p, sat: true }));
const missed = (): ExamPoint => ({ pct: null, sat: false });

test("percentage is rounded to one decimal and safe for zero total", () => {
  assert.equal(pct(7, 9), 77.8);
  assert.equal(pct(5, 0), 0);
});

test("average is of exams SAT; absences only lower the with-absent figure", () => {
  const s = summariseStudent([...sat(80, 60), missed()]);
  assert.equal(s.average, 70);
  assert.equal(s.averageWithAbsent, 46.7);
  assert.equal(s.participation, 67);
});

test("too few exams: no verdict, no flag", () => {
  const s = summariseStudent(sat(20, 30));
  assert.equal(s.flag, null);
  assert.equal(s.enoughData, false);
  assert.equal(s.trend, null);
});

test("below the pass mark over 3+ exams needs attention", () => {
  const s = summariseStudent(sat(40, 45, 42));
  assert.equal(s.flag, "attention");
  assert.match(s.reasons[0], /below the 50% pass mark/);
});

test("missing 2 of 4 exams needs attention even with good scores", () => {
  const s = summariseStudent([...sat(90, 85), missed(), missed()]);
  assert.equal(s.flag, "attention");
  assert.match(s.reasons.join(" "), /Missed 2 of 4 exams/);
});

test("a sharp drop in the latest exam is flagged", () => {
  const s = summariseStudent(sat(80, 78, 82, 50));
  assert.equal(s.flag, "attention");
  assert.match(s.reasons.join(" "), /points below their earlier average/);
});

test("high average with good attendance is 'doing well'", () => {
  assert.equal(summariseStudent(sat(80, 85, 78)).flag, "doing_well");
});

test("a rising student below 75 is 'improving', not 'doing well'", () => {
  const s = summariseStudent(sat(52, 58, 66, 72));
  assert.equal(s.trend, "up");
  assert.equal(s.flag, "improving");
});

test("trend needs 3 results and a 10-point move", () => {
  assert.equal(trendOf([50, 90]), null);
  assert.equal(trendOf([60, 62, 64]), "flat");
  assert.equal(trendOf([80, 70, 60, 50]), "down");
});

test("histogram puts 100 in the top bin and counts every value once", () => {
  const h = histogram([0, 9, 10, 55, 100, 99.9]);
  assert.equal(h[0].count, 2);
  assert.equal(h[1].count, 1);
  assert.equal(h[5].count, 1);
  assert.equal(h[9].count, 2);
  assert.equal(h.reduce((n, b) => n + b.count, 0), 6);
});

test("most-missed ignores questions with too few answers and sorts hardest first", () => {
  const out = mostMissed([
    { questionId: "a", text: "A", topic: "t", answers: 10, earned: 3, possible: 10 },
    { questionId: "b", text: "B", topic: "t", answers: 2, earned: 0, possible: 2 },
    { questionId: "c", text: "C", topic: "t", answers: 8, earned: 6, possible: 8 }
  ]);
  assert.deepEqual(out.map((q) => q.questionId), ["a", "c"]);
  assert.equal(out[0].percentCorrect, 30);
});

test("topic accuracy merges tallies, hides thin topics, weakest first", () => {
  const out = topicAccuracy([
    { topic: "Fractions", earned: 2, possible: 4, questions: 2 },
    { topic: "Fractions", earned: 1, possible: 4, questions: 2 },
    { topic: "Decimals", earned: 9, possible: 10, questions: 5 },
    { topic: "Rare", earned: 0, possible: 2, questions: 2 }
  ]);
  assert.deepEqual(out.map((t) => t.topic), ["Fractions", "Decimals"]);
  assert.equal(out[0].percentCorrect, 38);
});
