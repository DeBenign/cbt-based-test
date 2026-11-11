import test from "node:test";
import assert from "node:assert/strict";
import Exam from "../src/models/Exam";
import ExamAttempt from "../src/models/ExamAttempt";
import Question from "../src/models/Question";
import User from "../src/models/User";
import Subject from "../src/models/Subject";
import Class from "../src/models/Class";
import School from "../src/models/School";
import Remark from "../src/models/Remark";
import * as finalize from "../src/services/finalizeExpired";
import { getClassReportCards, getMyReportCard } from "../src/controllers/reportCardController";
import { bandOf, parsePeriod, inPeriod } from "../src/services/reportCard";

const q = (rows: any[]) => { const p: any = Promise.resolve(rows); p.sort = () => p; p.select = () => p; return p; };
const one = (row: any) => { const p: any = Promise.resolve(row); p.select = () => p; return p; };
const day = 86_400_000;
const CLASS = "64b000000000000000000001", SUBJ = "64b000000000000000000002", SCHOOL = "64b0000000000000000000aa";

const students = ["s1", "s2", "s3", "s4", "s5"].map((id, i) => ({ _id: id, name: `Student${i + 1} Surname`, classId: CLASS, schoolId: SCHOOL, role: "student" }));
const questions = ["q1", "q2", "q3", "q4"].map((id) => ({ _id: id, topic: "Fractions", type: "mcq", marks: 1, questionText: id, options: [{ text: "right", isCorrect: true }, { text: "wrong", isCorrect: false }] }));
const exams = [1, 2, 3].map((n) => ({
  _id: `e${n}`, title: `Test ${n}`, startTime: new Date(Date.now() - (40 - n * 10) * day), endTime: new Date(Date.now() - (39 - n * 10) * day),
  questionIds: questions.map((x) => x._id), subjectId: SUBJ, classId: CLASS, schoolId: SCHOOL, status: "closed", createdBy: "t1"
}));
const answersWith = (right: number) => questions.map((x, i) => ({ questionId: x._id, selectedOption: i < right ? "right" : "wrong" }));
const att = (e: any, s: string, right: number) => ({ examId: e._id, studentId: s, score: right, needsGrading: false, answers: answersWith(right), submittedAt: new Date(+e.endTime - 3600_000) });
const attempts = [...exams.map((e) => att(e, "s1", 4)), ...exams.map((e) => att(e, "s2", 1)), att(exams[0], "s3", 2), ...exams.map((e) => att(e, "s4", 3)), ...exams.map((e) => att(e, "s5", 3))];

let remarks: any[] = [];
function stub(list = exams) {
  (Exam as any).find = () => q(list);
  (ExamAttempt as any).find = () => q(attempts);
  (Question as any).find = () => q(questions);
  (User as any).find = () => q(students);
  (User as any).findById = (id: string) => one(students.find((s) => s._id === id) ?? null);
  (Subject as any).find = () => q([{ _id: SUBJ, name: "Mathematics" }]);
  (Class as any).findOne = () => one({ _id: CLASS, name: "Primary 5" });
  (Class as any).exists = async () => ({ _id: CLASS });
  (School as any).findById = () => one({ name: "De-Benign Schools", branding: { logoUrl: "https://x/logo.png", primaryColor: "#123456" } });
  (Remark as any).find = (f: any) => q(remarks.filter((r) => r.status === f.status && f.studentId.$in.map(String).includes(String(r.studentId))));
  (finalize as any).finalizeExpiredAttempts = async () => undefined;
  remarks = [];
}
const run = async (fn: any, req: any) => {
  let out: any; let code = 200;
  const res: any = { status(c: number) { code = c; return res; }, json(b: any) { out = b; return res; } };
  await fn(req, res);
  return { code, out };
};
const admin = (query: any = { classId: CLASS }) => ({ user: { userId: "a1", schoolId: SCHOOL, role: "admin" }, query });
const stu = (id: string, query: any = {}) => ({ user: { userId: id, schoolId: SCHOOL, role: "student" }, query });
const remark = (studentId: string, kind: string, text: string, status = "released", subjectId?: string) =>
  ({ studentId, kind, text, status, subjectId, releasedAt: new Date() });

test("band uses the pass and good marks; period parsing is strict and inclusive of the end day", () => {
  assert.deepEqual([bandOf(80), bandOf(60), bandOf(30), bandOf(null)], ["good", "pass", "below", null]);
  assert.equal(parsePeriod("nonsense", undefined).error?.includes("2026-09-14"), true);
  assert.equal(parsePeriod("2026-10-01", "2026-09-01").error, "The end date is before the start date.");
  const p = parsePeriod("2026-09-01", "2026-09-30");
  assert.equal(inPeriod("2026-09-30T23:00:00Z", p), true);   // the whole end day counts
  assert.equal(inPeriod("2026-10-01T00:00:00Z", p), false);
  assert.equal(inPeriod("2026-08-31T23:59:00Z", p), false);
});

test("class cards: one per student, school branding, subject rows with numbers", async () => {
  stub();
  const { code, out } = await run(getClassReportCards, admin());
  assert.equal(code, 200);
  assert.equal(out.cards.length, 5);
  assert.equal(out.school.name, "De-Benign Schools");
  assert.equal(out.school.primaryColor, "#123456");
  assert.equal(out.className, "Primary 5");
  const s1 = out.cards.find((c: any) => c.student.name === "Student1 Surname");
  assert.equal(s1.subjects.length, 1);
  assert.equal(s1.subjects[0].subjectName, "Mathematics");
  assert.equal(s1.subjects[0].average, 100);
  assert.equal(s1.subjects[0].band, "good");
  assert.equal(s1.subjects[0].sat, 3);
  assert.ok(s1.subjects[0].classAverage !== null);
  assert.equal(s1.overall.average, 100);
  const s3 = out.cards.find((c: any) => c.student.name === "Student3 Surname");
  assert.equal(s3.subjects[0].sat, 1);          // sat 1 of 3: the card shows it honestly
  assert.equal(s3.subjects[0].exams, 3);
});

test("only RELEASED remarks reach a card; drafts never do", async () => {
  stub();
  remarks = [
    remark("s1", "subject", "Subject remark for Student1.", "released", SUBJ),
    remark("s1", "overall", "Overall remark for Student1."),
    remark("s2", "subject", "A DRAFT that must stay hidden.", "draft", SUBJ),
    remark("s2", "overall", "Another DRAFT.", "draft")
  ];
  const { out } = await run(getClassReportCards, admin());
  const s1 = out.cards.find((c: any) => c.student.name === "Student1 Surname");
  const s2 = out.cards.find((c: any) => c.student.name === "Student2 Surname");
  assert.equal(s1.subjects[0].remark, "Subject remark for Student1.");
  assert.equal(s1.overall.remark, "Overall remark for Student1.");
  assert.equal(s2.subjects[0].remark, null);
  assert.equal(s2.overall.remark, null);
  assert.ok(!JSON.stringify(out).includes("DRAFT"));
  assert.equal(out.pending.subjectRemarks, 4);   // 5 students minus the one released
  assert.equal(out.pending.overall, 4);
});

test("a student gets only their own card, with no other student's data", async () => {
  stub();
  remarks = [remark("s1", "subject", "Mine.", "released", SUBJ), remark("s4", "subject", "Not yours.", "released", SUBJ)];
  const { out } = await run(getMyReportCard, stu("s1"));
  assert.equal(out.card.student.name, "Student1 Surname");
  assert.equal(out.card.subjects[0].remark, "Mine.");
  const text = JSON.stringify(out);
  assert.ok(!text.includes("Student2") && !text.includes("Not yours") && !text.includes("Student4"));
  assert.equal(out.cards, undefined);
});

test("the period filter limits which exams count", async () => {
  stub();
  const first = exams[0];
  const day0 = new Date(+first.startTime).toISOString().slice(0, 10);
  const { out } = await run(getClassReportCards, admin({ classId: CLASS, from: day0, to: day0 }));
  assert.equal(out.examCount, 1);
  const s1 = out.cards.find((c: any) => c.student.name === "Student1 Surname");
  assert.equal(s1.subjects[0].exams, 1);
});

test("no finished exams gives an empty set, bad input is refused", async () => {
  stub([]);
  const empty = await run(getClassReportCards, admin());
  assert.deepEqual([empty.out.cards.length, empty.out.examCount], [0, 0]);
  assert.equal((await run(getClassReportCards, admin({ classId: "nope" }))).code, 400);
  assert.equal((await run(getClassReportCards, admin({ classId: CLASS, from: "bad" }))).code, 400);
});
