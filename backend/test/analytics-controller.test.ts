import test from "node:test";
import assert from "node:assert/strict";
import Exam from "../src/models/Exam";
import ExamAttempt from "../src/models/ExamAttempt";
import Question from "../src/models/Question";
import User from "../src/models/User";
import Subject from "../src/models/Subject";
import Class from "../src/models/Class";
import * as finalize from "../src/services/finalizeExpired";
import { getMyAnalytics, getClassAnalytics, listAnalyticsOptions } from "../src/controllers/analyticsController";

// A thenable that also answers .sort()/.select(), like a Mongoose query.
const q = (rows: any[]) => { const p: any = Promise.resolve(rows); p.sort = () => p; p.select = () => p; return p; };
const one = (row: any) => { const p: any = Promise.resolve(row); p.select = () => p; return p; }; // findById / findOne

const CLASS = "64b000000000000000000001";
const SUBJ = "64b000000000000000000002";
const day = 86_400_000;
const students = ["s1", "s2", "s3", "s4", "s5"].map((id, i) => ({ _id: id, name: `Student ${i + 1}`, classId: CLASS, schoolId: "sch" }));

// 3 finished exams, each with 6 one-mark MCQs on two topics (3 each).
const questions = ["q1", "q2", "q3", "q4", "q5", "q6"].map((id, i) => ({
  _id: id, topic: i < 3 ? "Fractions" : "Decimals", type: "mcq", marks: 1, questionText: `Question ${id}`,
  options: [{ text: "right", isCorrect: true }, { text: "wrong", isCorrect: false }]
}));
const exams = [1, 2, 3].map((n) => ({
  _id: `e${n}`, title: `Test ${n}`, startTime: new Date(Date.now() - (10 - n) * day), endTime: new Date(Date.now() - (9 - n) * day),
  questionIds: questions.map((x) => x._id), subjectId: SUBJ, classId: CLASS, schoolId: "sch", status: "closed"
}));

// s1 aces everything, s2 fails everything, s3 skips 2 of 3 exams, s4/s5 are middling.
const answersWith = (right: number) => questions.map((x, i) => ({ questionId: x._id, selectedOption: i < right ? "right" : "wrong" }));
const attempt = (e: string, s: string, right: number) => ({ examId: e, studentId: s, score: right, needsGrading: false, answers: answersWith(right) });
const attempts = [
  ...exams.map((e) => attempt(e._id, "s1", 6)),
  ...exams.map((e) => attempt(e._id, "s2", 0)),
  attempt("e1", "s3", 4),
  ...exams.map((e) => attempt(e._id, "s4", 3)),
  ...exams.map((e) => attempt(e._id, "s5", 4))
];

function stub() {
  (Exam as any).find = () => q(exams);
  (ExamAttempt as any).find = () => q(attempts);
  (Question as any).find = () => q(questions);
  (User as any).find = () => q(students);
  (User as any).findById = (id: string) => one(students.find((s) => s._id === id) ?? { _id: id, subjectIds: [SUBJ] });
  (Subject as any).find = () => q([{ _id: SUBJ, name: "Mathematics" }]);
  (Subject as any).findOne = () => one({ _id: SUBJ, name: "Mathematics" });
  (Class as any).find = () => q([{ _id: CLASS, name: "Primary 5" }]);
  (Class as any).findOne = () => one({ _id: CLASS, name: "Primary 5" });
  (finalize as any).finalizeExpiredAttempts = async () => undefined;
}

const run = async (fn: any, req: any) => {
  let out: any; let code = 200;
  const res: any = { status(c: number) { code = c; return res; }, json(b: any) { out = b; return res; } };
  await fn(req, res);
  return { code, out };
};

test("student view: own series, class average, absent shown as 0, topics", async () => {
  stub();
  const { out } = await run(getMyAnalytics, { user: { userId: "s3", schoolId: "sch", role: "student" } });
  assert.equal(out.subjects.length, 1);
  const s = out.subjects[0];
  assert.equal(s.subjectName, "Mathematics");
  assert.equal(s.series.length, 3);
  assert.equal(s.series[0].pct, 66.7);             // sat e1: 4/6
  assert.equal(s.series[1].absent, true);          // missed e2
  assert.equal(s.series[1].pct, 0);                // plotted as 0
  assert.equal(s.average, 66.7);                   // average of exams SAT only
  assert.equal(s.participation, 33);
  assert.ok(s.series[0].classAvg !== null);        // 5 classmates sat e1, so it is shown
  assert.equal(out.overall.exams, 3);
  assert.ok(out.topics.weakest.length > 0);
});

test("student view: no other student's name or score is exposed", async () => {
  stub();
  const { out } = await run(getMyAnalytics, { user: { userId: "s1", schoolId: "sch", role: "student" } });
  const text = JSON.stringify(out);
  assert.ok(!text.includes("Student 2") && !text.includes("s2"));
});

test("student view: class average hidden when fewer than 3 classmates sat", async () => {
  stub();
  (ExamAttempt as any).find = () => q(attempts.filter((a) => a.studentId === "s1" || a.studentId === "s2"));
  const { out } = await run(getMyAnalytics, { user: { userId: "s1", schoolId: "sch", role: "student" } });
  assert.equal(out.subjects[0].series[0].classAvg, null);
});

test("class view: flags, distribution, participation and most-missed", async () => {
  stub();
  const { code, out } = await run(getClassAnalytics, { user: { userId: "t1", schoolId: "sch", role: "teacher" }, query: { classId: CLASS, subjectId: SUBJ } });
  assert.equal(code, 200);
  assert.equal(out.summary.exams, 3);
  assert.equal(out.summary.students, 5);
  const byName = Object.fromEntries(out.students.map((x: any) => [x.name, x]));
  assert.equal(byName["Student 1"].flag, "doing_well");
  assert.equal(byName["Student 2"].flag, "attention");   // 0% average
  assert.equal(byName["Student 3"].flag, "attention");   // missed 2 of 3
  assert.equal(out.students[0].name, "Student 1");       // best first
  assert.equal(out.exams[1].sat, 4);
  assert.equal(out.exams[1].absent, 1);
  assert.equal(out.distribution.reduce((n: number, b: any) => n + b.count, 0), 5);
  assert.ok(out.mostMissed.length > 0);
  assert.ok(out.topics.find((t: any) => t.topic === "Decimals"));
});

test("class view: a teacher cannot open a subject they don't teach", async () => {
  stub();
  (User as any).findById = () => one({ subjectIds: ["someone-elses-subject"] });
  const { code } = await run(getClassAnalytics, { user: { userId: "t2", schoolId: "sch", role: "teacher" }, query: { classId: CLASS, subjectId: SUBJ } });
  assert.equal(code, 403);
});

test("class view: admin may open any class and subject", async () => {
  stub();
  const { code } = await run(getClassAnalytics, { user: { userId: "a1", schoolId: "sch", role: "admin" }, query: { classId: CLASS, subjectId: SUBJ } });
  assert.equal(code, 200);
});

test("class view: bad ids are refused", async () => {
  stub();
  const { code } = await run(getClassAnalytics, { user: { userId: "t1", schoolId: "sch", role: "teacher" }, query: { classId: "x", subjectId: "y" } });
  assert.equal(code, 400);
});

test("options lists each class-and-subject pair once with its exam count", async () => {
  stub();
  const { out } = await run(listAnalyticsOptions, { user: { userId: "t1", schoolId: "sch", role: "teacher" } });
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].className, out[0].subjectName, out[0].exams], ["Primary 5", "Mathematics", 3]);
});
