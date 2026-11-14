import test from "node:test";
import assert from "node:assert/strict";
import Question from "../src/models/Question";
import User from "../src/models/User";
import Subject from "../src/models/Subject";
import Class from "../src/models/Class";
import AuditLog from "../src/models/AuditLog";
import { clearTeacherScopeCache } from "../src/utils/teacherScope";
import { importQuestions } from "../src/controllers/questionImportController";

const q = (rows: any[]) => { const p: any = Promise.resolve(rows); p.sort = () => p; p.select = () => p; p.lean = () => p; return p; };
const one = (row: any) => { const p: any = Promise.resolve(row); p.select = () => p; p.lean = () => p; return p; };

const MATHS = "64b0000000000000000000a1", ENG = "64b0000000000000000000a2";
const P5 = "64b0000000000000000000b1", JSS3 = "64b0000000000000000000b2";

let saved: any[] = [];
function stub(teacher = { subjectIds: [MATHS, ENG], classIds: [P5] }, bank: any[] = []) {
  clearTeacherScopeCache();
  saved = [];
  (Subject as any).find = () => q([
    { _id: MATHS, name: "Mathematics", classIds: [P5, JSS3] },
    { _id: ENG, name: "English Language", classIds: [P5] }
  ]);
  (Class as any).find = () => q([{ _id: P5, name: "Primary 5" }, { _id: JSS3, name: "JSS 3" }]);
  (User as any).findById = () => one(teacher);
  (Question as any).find = () => q(bank);
  (Question as any).insertMany = async (docs: any[]) => { saved.push(...docs); return docs; };
  (AuditLog as any).create = async () => ({});
}

const run = async (body: any) => {
  let code = 200, out: any;
  const res: any = { locals: {}, status(c: number) { code = c; return res; }, json(o: any) { out = o; return res; } };
  await importQuestions({ user: { userId: "t1", schoolId: "sch", role: "teacher" }, body, res } as any, res);
  return { code, out };
};

const row = (over: any = {}) => ({
  subject: "Mathematics", class: "Primary 5", question: "What is 2 + 2?", optionA: "3", optionB: "4", correct: "B", ...over
});

test("checking a file saves nothing and reports ready, duplicate and problem rows", async () => {
  stub(undefined, [{ subjectId: MATHS, classId: P5, questionText: "What is 7 x 8?" }]);
  const { out } = await run({
    dryRun: true,
    rows: [
      row({ rowNumber: 2 }),
      row({ rowNumber: 3, question: "What is 7 x 8?", optionA: "56", optionB: "54", correct: "A" }),
      row({ rowNumber: 4, class: "JSS 3", question: "A different class question" }),
      row({ rowNumber: 5, question: "What is 2 + 2?" })
    ]
  });
  assert.equal(saved.length, 0);
  assert.deepEqual(out.results.map((r: any) => r.status), ["ready", "skipped", "error", "skipped"]);
  assert.match(out.results[1].reason, /Already in the question bank/);
  assert.match(out.results[2].reason, /not assigned to JSS 3/);
  assert.match(out.results[3].reason, /Repeats an earlier row/);
  assert.deepEqual(out.summary, { ready: 1, created: 0, skipped: 2, errors: 1 });
});

test("importing saves only rows that pass and skips what is already in the bank", async () => {
  stub(undefined, [{ subjectId: MATHS, classId: P5, questionText: "What is 7 x 8?" }]);
  const { out } = await run({
    rows: [row({ rowNumber: 2 }), row({ rowNumber: 3, question: "What is 7 x 8?", optionA: "56", optionB: "54", correct: "A" })]
  });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].questionText, "What is 2 + 2?");
  assert.equal(saved[0].reviewStatus, "approved");
  assert.deepEqual(out.results.map((r: any) => r.status), ["created", "skipped"]);
});

test("a row for a different class than the chosen target is flagged", async () => {
  stub({ subjectIds: [MATHS], classIds: [P5, JSS3] });
  const { out } = await run({ dryRun: true, targetSubjectId: MATHS, targetClassId: P5, rows: [row({ rowNumber: 2, class: "JSS 3" }), row({ rowNumber: 3, class: "" })] });
  assert.equal(out.results[0].status, "error");
  assert.match(out.results[0].reason, /is for JSS 3, but you're importing into Primary 5/);
  assert.equal(out.results[1].status, "ready"); // blank class inherits Primary 5
});

test("a teacher with no classes assigned cannot import", async () => {
  stub({ subjectIds: [MATHS], classIds: [] });
  const { out } = await run({ rows: [row({ rowNumber: 2 })] });
  assert.equal(saved.length, 0);
  assert.equal(out.results[0].status, "error");
});

test("checking accepts a whole sheet, saving is limited to small groups", async () => {
  stub();
  const many = Array.from({ length: 60 }, (_, i) => row({ rowNumber: i + 2, question: `Unique question number ${i} about topic ${i * 7}` }));
  assert.equal((await run({ dryRun: true, rows: many })).code, 200);
  assert.equal((await run({ rows: many })).code, 400);
});
