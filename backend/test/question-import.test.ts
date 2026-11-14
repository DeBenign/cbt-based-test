import test from "node:test";
import assert from "node:assert/strict";
import { DedupeIndex } from "../src/services/questionDedupe";
import { inScope, denyReason } from "../src/utils/teacherScope";
import { checkRow, findDuplicates, resolveCorrect, parseType, parseMarks, ImportContext, ImportRow } from "../src/services/questionImport";

const ctx = (allowed: string[] | null = ["s1"], classes: string[] | null = ["c1", "c2"]): ImportContext => ({
  subjects: new Map([
    ["mathematics", { id: "s1", name: "Mathematics", classIds: ["c1"] }],
    ["english language", { id: "s2", name: "English Language", classIds: ["c1", "c2"] }]
  ]),
  classes: new Map([
    ["primary 5", { id: "c1", name: "Primary 5" }],
    ["jss 3", { id: "c2", name: "JSS 3" }]
  ]),
  allowedSubjectIds: allowed ? new Set(allowed) : null,
  allowedClassIds: classes ? new Set(classes) : null
});

const mcq = (over: ImportRow = {}): ImportRow => ({
  subject: "Mathematics", class: "Primary 5", topic: "Fractions", difficulty: "easy",
  question: "What is 1/2 + 1/4?", optionA: "3/4", optionB: "2/6", optionC: "1/8", optionD: "1", correct: "A", ...over
});

test("a complete MCQ row is accepted with the right option marked correct", () => {
  const r = checkRow(mcq(), ctx());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.question.type, "mcq");
    assert.equal(r.question.marks, 1);
    assert.deepEqual(r.question.options.map((o) => o.isCorrect), [true, false, false, false]);
  }
});

test("names are matched ignoring case and spaces", () => {
  assert.equal(checkRow(mcq({ subject: "  mathematics ", class: "PRIMARY 5" }), ctx()).ok, true);
});

test("the correct answer can be a letter, a letter with a bracket, or the option text", () => {
  const opts = [{ letter: "A", text: "Lagos" }, { letter: "B", text: "Abuja" }];
  assert.equal(resolveCorrect("b", opts), 1);
  assert.equal(resolveCorrect("B)", opts), 1);
  assert.equal(resolveCorrect("abuja", opts), 1);
});

test("a missing, empty-option or unmatched correct answer is rejected", () => {
  const opts = [{ letter: "A", text: "Lagos" }, { letter: "B", text: "Abuja" }];
  assert.deepEqual(Object.keys(resolveCorrect("", opts) as object), ["error"]);
  assert.match((resolveCorrect("D", opts) as any).error, /option D is empty/);
  assert.match((resolveCorrect("Kano", opts) as any).error, /doesn't match/);
});

test("MCQ needs two options and no repeated option text", () => {
  const one = checkRow(mcq({ optionB: "", optionC: "", optionD: "" }), ctx());
  assert.equal(one.ok, false);
  const same = checkRow(mcq({ optionB: "3/4" }), ctx());
  assert.equal(same.ok, false);
  if (!same.ok) assert.match(same.reason, /same text/);
});

test("a row with no options and no type is treated as theory, defaulting to 5 marks", () => {
  const r = checkRow({ subject: "Mathematics", class: "Primary 5", question: "Define a fraction.", answer: "A part of a whole." }, ctx());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.question.type, "theory");
    assert.equal(r.question.marks, 5);
    assert.equal(r.question.correctAnswerText, "A part of a whole.");
    assert.equal(r.question.topic, "General");
  }
});

test("unknown subject, unknown class and unlinked subject-class pairs give clear reasons", () => {
  const a = checkRow(mcq({ subject: "Physics" }), ctx(null));
  const b = checkRow(mcq({ class: "SS1" }), ctx());
  const c = checkRow(mcq({ subject: "English Language", class: "JSS 3" }), ctx(null));
  const d = checkRow(mcq({ subject: "Mathematics", class: "JSS 3" }), ctx());
  assert.ok(!a.ok && /doesn't exist/.test(a.reason));
  assert.ok(!b.ok && /doesn't exist/.test(b.reason));
  assert.equal(c.ok, true);
  assert.ok(!d.ok && /isn't linked/.test(d.reason));
});

test("a teacher cannot import into a subject they are not assigned to", () => {
  const r = checkRow(mcq({ subject: "English Language" }), ctx(["s1"]));
  assert.ok(!r.ok && /not assigned/.test(r.reason));
});

test("bad type, difficulty and marks are rejected; blanks fall back to defaults", () => {
  assert.equal(parseType("essay", false), "theory");
  assert.equal(parseType("", true), "mcq");
  assert.equal(parseType("quiz", true), null);
  assert.equal(parseMarks("", 1), 1);
  assert.equal(parseMarks("abc", 1), null);
  assert.equal(parseMarks("0", 1), null);
  assert.ok(!checkRow(mcq({ difficulty: "tough" }), ctx()).ok);
  assert.ok(!checkRow(mcq({ marks: "-2" }), ctx()).ok);
  assert.ok(!checkRow(mcq({ question: "   " }), ctx()).ok);
});

test("duplicates are caught against the bank and within the file, per subject and class", () => {
  const items = [
    { subjectId: "s1", classId: "c1", questionText: "What is 1/2 + 1/4?" },
    { subjectId: "s1", classId: "c1", questionText: "What is 1/2 + 1/4" },
    { subjectId: "s1", classId: "c1", questionText: "What is 1/2 + 1/3?" },
    { subjectId: "s2", classId: "c1", questionText: "What is 1/2 + 1/4?" },
    { subjectId: "s1", classId: "c1", questionText: "Name the capital of Nigeria." }
  ];
  const flags = findDuplicates(items, new Map([["s1:c1", ["name the capital of nigeria"]]]));
  assert.deepEqual(flags.map((f) => f && f.kind), [null, "file", null, null, "bank"]);
  assert.equal(flags[4]!.match, "name the capital of nigeria");
});
test("a row for a class the teacher is not assigned to is flagged", () => {
  const r = checkRow(mcq({ subject: "English Language", class: "JSS 3" }), ctx(["s2"], ["c1"]));
  assert.ok(!r.ok && /not assigned to JSS 3/.test(r.reason));
});

test("a teacher with no classes assigned cannot import anything", () => {
  const r = checkRow(mcq(), ctx(["s1"], []));
  assert.ok(!r.ok && /not assigned to Primary 5/.test(r.reason));
});

test("when a target class is chosen, a row naming a different class is flagged", () => {
  const c = ctx(["s2"], ["c1", "c2"]);
  c.target = { subjectId: "s2", subjectName: "English Language", classId: "c1", className: "Primary 5" };
  const r = checkRow(mcq({ subject: "English Language", class: "JSS 3" }), c);
  assert.ok(!r.ok && /is for JSS 3, but you're importing into Primary 5/.test(r.reason));
});

test("when a target subject is chosen, a row naming a different subject is flagged", () => {
  const c = ctx(["s1", "s2"], ["c1"]);
  c.target = { subjectId: "s1", subjectName: "Mathematics", classId: "c1", className: "Primary 5" };
  const r = checkRow(mcq({ subject: "English Language" }), c);
  assert.ok(!r.ok && /importing into Mathematics/.test(r.reason));
});

test("blank subject and class cells inherit the chosen target", () => {
  const c = ctx();
  c.target = { subjectId: "s1", subjectName: "Mathematics", classId: "c1", className: "Primary 5" };
  const r = checkRow(mcq({ subject: "", class: "" }), c);
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual([r.question.subjectId, r.question.classId], ["s1", "c1"]);
});

test("DedupeIndex matches reworded repeats but never a changed number", () => {
  const idx = new DedupeIndex(["What is 12 x 5?", "Name the capital city of Nigeria"]);
  assert.equal(idx.find("what is 12 x 5"), "What is 12 x 5?");
  assert.equal(idx.find("What is 12 x 6?"), null);
  assert.equal(idx.find("Name the capital city of Nigeria please"), "Name the capital city of Nigeria");
  assert.equal(idx.find("Define a noun"), null);
});

test("a teacher can use a subject/class pair only when both are assigned", () => {
  const scope = { subjectIds: ["s1"], classIds: ["c1"] };
  assert.equal(inScope(scope, "s1", "c1"), true);
  assert.equal(inScope(scope, "s1", "c2"), false);
  assert.equal(inScope(scope, "s2", "c1"), false);
  assert.equal(denyReason(scope, "s1", "c1"), null);
  assert.match(denyReason(scope, "s2", "c1")!, /subject/);
  assert.match(denyReason(scope, "s1", "c2")!, /class/);
  assert.match(denyReason({ subjectIds: ["s1"], classIds: [] }, "s1", "c1")!, /any classes yet/);
});
