import test from "node:test";
import { clearTeacherScopeCache } from "../src/utils/teacherScope";
import assert from "node:assert/strict";
import Exam from "../src/models/Exam";
import ExamAttempt from "../src/models/ExamAttempt";
import Question from "../src/models/Question";
import User from "../src/models/User";
import Subject from "../src/models/Subject";
import Class from "../src/models/Class";
import Remark from "../src/models/Remark";
import * as finalize from "../src/services/finalizeExpired";
import { getSchoolOverview } from "../src/controllers/overviewController";
import { getStaffIndicators } from "../src/controllers/staffController";
import { generateRemarks, listRemarks, editRemark, releaseRemarks, getMyRemarks } from "../src/controllers/remarkController";
import { buildSubjectRemark, buildOverallRemark, RemarkFacts } from "../src/services/remarkText";
import { gradingStats, buildSignals, median } from "../src/services/staffIndicators";

const q = (rows: any[]) => { const p: any = Promise.resolve(rows); p.sort = () => p; p.select = () => p; p.lean = () => p; return p; };
const one = (row: any) => { const p: any = Promise.resolve(row); p.select = () => p; p.lean = () => p; return p; };
const day = 86_400_000;

const CLASS = "64b000000000000000000001", SUBJ = "64b000000000000000000002", SCHOOL = "sch";
const students = ["s1", "s2", "s3", "s4", "s5"].map((id, i) => ({ _id: id, name: `Student${i + 1} Surname`, classId: CLASS, schoolId: SCHOOL, role: "student" }));
const teachers = [{ _id: "t1", name: "Mrs Teacher", subjectIds: [SUBJ], classIds: [CLASS], role: "teacher" }, { _id: "t2", name: "Mr Other", subjectIds: [], classIds: [], role: "teacher" }];
const questions = ["q1", "q2", "q3", "q4", "q5", "q6"].map((id, i) => ({
  _id: id, topic: i < 3 ? "Fractions" : "Decimals", type: "mcq", marks: 1, questionText: `Question ${id}`,
  options: [{ text: "right", isCorrect: true }, { text: "wrong", isCorrect: false }]
}));
const exams = [1, 2, 3].map((n) => ({
  _id: `e${n}`, title: `Test ${n}`, startTime: new Date(Date.now() - (30 - n * 8) * day), endTime: new Date(Date.now() - (29 - n * 8) * day),
  questionIds: questions.map((x) => x._id), subjectId: SUBJ, classId: CLASS, schoolId: SCHOOL, status: "closed", createdBy: "t1"
}));
const answersWith = (right: number) => questions.map((x, i) => ({ questionId: x._id, selectedOption: i < right ? "right" : "wrong" }));
const attempt = (e: any, s: string, right: number, extra: any = {}) => ({
  examId: e._id, studentId: s, score: right, needsGrading: false, answers: answersWith(right), submittedAt: new Date(+e.endTime - 3600_000), ...extra
});
const attempts = [
  ...exams.map((e) => attempt(e, "s1", 6)), ...exams.map((e) => attempt(e, "s2", 0)), attempt(exams[0], "s3", 4),
  ...exams.map((e) => attempt(e, "s4", 3)), ...exams.map((e) => attempt(e, "s5", 4))
];

// ---- a tiny in-memory Remark collection
let store: any[] = [];
let nextId = 1;
const matches = (doc: any, f: any) => Object.entries(f).every(([k, v]: [string, any]) =>
  v && typeof v === "object" && "$in" in v ? v.$in.map(String).includes(String(doc[k])) : String(doc[k]) === String(v));
function fakeRemarks() {
  store = []; nextId = 1;
  const wrap = (d: any) => Object.assign(d, { save: async () => undefined });
  (Remark as any).find = (f: any) => q(store.filter((d) => matches(d, f)));
  (Remark as any).findOne = (f: any) => one(store.find((d) => matches(d, f)) ?? null);
  (Remark as any).create = async (d: any) => { const doc = wrap({ _id: `64c${String(nextId++).padStart(21, "0")}`, createdAt: new Date(Date.now() + nextId), releasedAt: undefined, ...d }); store.push(doc); return doc; };
  (Remark as any).updateMany = async (f: any, u: any) => {
    const hit = store.filter((d) => matches(d, f));
    hit.forEach((d) => { Object.assign(d, u.$set); if (u.$unset) for (const k of Object.keys(u.$unset)) delete d[k]; });
    return { modifiedCount: hit.length };
  };
}

function stub(opts: { attempts?: any[] } = {}) {
  clearTeacherScopeCache();
  (Exam as any).find = () => q(exams);
  (ExamAttempt as any).find = () => q(opts.attempts ?? attempts);
  (Question as any).find = () => q(questions);
  (User as any).find = (f: any = {}) => q(f.role === "teacher" ? teachers.filter((t) => !f._id || t._id === String(f._id)) : f._id ? teachers.filter((t) => t._id === String(f._id)) : students);
  (User as any).findById = (id: string) => one([...students, ...teachers].find((u) => u._id === id) ?? null);
  (Subject as any).find = () => q([{ _id: SUBJ, name: "Mathematics" }]);
  (Subject as any).findOne = () => one({ _id: SUBJ, name: "Mathematics" });
  (Class as any).find = () => q([{ _id: CLASS, name: "Primary 5" }]);
  (Class as any).findOne = () => one({ _id: CLASS, name: "Primary 5" });
  (finalize as any).finalizeExpiredAttempts = async () => undefined;
  fakeRemarks();
}
const run = async (fn: any, req: any) => {
  let out: any; let code = 200;
  const res: any = { status(c: number) { code = c; return res; }, json(b: any) { out = b; return res; } };
  await fn(req, res);
  return { code, out };
};
const teacher = (id = "t1") => ({ user: { userId: id, schoolId: SCHOOL, role: "teacher" } });
const admin = { user: { userId: "a1", schoolId: SCHOOL, role: "admin" } };
const student = (id: string) => ({ user: { userId: id, schoolId: SCHOOL, role: "student" } });

// ---------------------------------------------------------------- Phase 2: overview
test("overview: class and subject rows, and the right students in each list", async () => {
  stub();
  const { out } = await run(getSchoolOverview, admin);
  assert.equal(out.summary.students, 5);
  assert.equal(out.classes.length, 1);
  assert.equal(out.classes[0].className, "Primary 5");
  assert.equal(out.subjects[0].subjectName, "Mathematics");
  assert.deepEqual(out.doingWell.map((p: any) => p.name), ["Student1 Surname"]);
  assert.deepEqual(out.attention.map((p: any) => p.name).sort(), ["Student2 Surname", "Student3 Surname"]);
  const s2 = out.attention.find((p: any) => p.name === "Student2 Surname");
  assert.deepEqual(s2.weakSubjects, ["Mathematics"]);
  assert.equal(out.summary.attention, 2);
});
test("overview: an empty school gets a clear message, not an error", async () => {
  stub();
  (Exam as any).find = () => q([]);
  const { out } = await run(getSchoolOverview, admin);
  assert.equal(out.summary, null);
  assert.match(out.message, /No finished exams/);
});

// ---------------------------------------------------------------- Phase 3: remarks
const facts = (o: Partial<RemarkFacts> = {}): RemarkFacts => ({ average: 68, classAverage: 60, participation: 100, exams: 4, sat: 4, trend: null, flag: null, enoughData: true, weakTopics: [], strongTopics: [], ...o });

test("remark wording: every sentence comes from a number; thin data gets no verdict", () => {
  assert.match(buildSubjectRemark(facts({ average: 82, flag: "doing_well" }), "Maths", "Ada"), /doing well in Maths, averaging 82%.*Keep up the good work/);
  assert.match(buildSubjectRemark(facts({ average: 40, flag: "attention", weakTopics: ["Fractions", "Decimals"] }), "Maths", "Ada"), /below the pass mark.*Fractions and Decimals.*Extra support/);
  assert.match(buildSubjectRemark(facts({ average: null, enoughData: false, sat: 2, exams: 2 }), "Maths", "Ada"), /too few for a fair review/);
  assert.match(buildSubjectRemark(facts({ sat: 0, exams: 3, average: null, enoughData: false }), "Maths", "Ada"), /not taken any Maths exam/);
  assert.match(buildSubjectRemark(facts({ participation: 50, exams: 4, sat: 2 }), "Maths", "Ada"), /missed 2 of 4 exams/);
  assert.match(buildSubjectRemark(facts({ average: 70, classAverage: 60 }), "Maths", "Ada"), /above the class average of 60%/);
  assert.match(buildOverallRemark(facts({ strongestSubject: "English", weakestSubject: "Maths" }), "Ada"), /Strongest in English; needs the most work in Maths/);
});

test("remarks: teacher generates drafts for the class; students see nothing yet", async () => {
  stub();
  const g = await run(generateRemarks, { ...teacher(), body: { classId: CLASS, subjectId: SUBJ } });
  assert.equal(g.code, 200);
  assert.equal(g.out.created, 5);
  assert.ok(store.every((r) => r.status === "draft" && r.kind === "subject"));
  assert.match(store.find((r) => String(r.studentId) === "s1").text, /Student1 is doing well in Mathematics/);
  const mine = await run(getMyRemarks, student("s1"));
  assert.deepEqual(mine.out, []);
});

test("remarks: regenerating refreshes drafts but never overwrites a teacher's own words", async () => {
  stub();
  await run(generateRemarks, { ...teacher(), body: { classId: CLASS, subjectId: SUBJ } });
  const r = store.find((x) => String(x.studentId) === "s2");
  const e = await run(editRemark, { ...teacher(), params: { id: r._id }, body: { text: "Ben needs a catch-up plan; see me on Friday." } });
  assert.equal(e.out.edited, true);
  const g = await run(generateRemarks, { ...teacher(), body: { classId: CLASS, subjectId: SUBJ } });
  assert.equal(g.out.refreshed, 5);
  assert.equal(g.out.keptYourEdits, 1);
  assert.equal(store.length, 5);
  assert.equal(r.text, "Ben needs a catch-up plan; see me on Friday.");
});

test("remarks: released remarks reach only that student; withdrawn ones disappear", async () => {
  stub();
  await run(generateRemarks, { ...teacher(), body: { classId: CLASS, subjectId: SUBJ } });
  const r1 = store.find((x) => String(x.studentId) === "s1");
  const rel = await run(releaseRemarks, { ...teacher(), body: { ids: [r1._id], release: true } });
  assert.equal(rel.out.updated, 1);
  const mine = await run(getMyRemarks, student("s1"));
  assert.equal(mine.out.length, 1);
  assert.equal(mine.out[0].subjectName, "Mathematics");
  assert.ok(!JSON.stringify(mine.out).includes("facts"));                    // numbers behind it are not exposed
  assert.deepEqual((await run(getMyRemarks, student("s2"))).out, []);        // another student sees nothing
  await run(releaseRemarks, { ...teacher(), body: { ids: [r1._id], release: false } });
  assert.deepEqual((await run(getMyRemarks, student("s1"))).out, []);
});

test("remarks: a released remark must be withdrawn before it can be edited", async () => {
  stub();
  await run(generateRemarks, { ...teacher(), body: { classId: CLASS, subjectId: SUBJ } });
  const r = store[0];
  await run(releaseRemarks, { ...teacher(), body: { ids: [r._id], release: true } });
  const e = await run(editRemark, { ...teacher(), params: { id: r._id }, body: { text: "New words" } });
  assert.equal(e.code, 400);
});

test("remarks: roles stay in their lane (teacher = subject, admin = overall)", async () => {
  stub();
  assert.equal((await run(generateRemarks, { ...admin, body: { classId: CLASS, subjectId: SUBJ } })).code, 400);   // admin can't write subject remarks
  assert.equal((await run(generateRemarks, { ...teacher(), body: { classId: CLASS } })).code, 400);                // teacher must pick a subject
  assert.equal((await run(generateRemarks, { ...teacher("t2"), body: { classId: CLASS, subjectId: SUBJ } })).code, 403); // t2 doesn't teach it
  const o = await run(generateRemarks, { ...admin, body: { classId: CLASS } });
  assert.equal(o.out.created, 5);
  const overall = store.find((r) => r.kind === "overall");
  assert.ok(overall && !overall.subjectId);
  // a teacher cannot edit or release the admin's overall remark
  assert.equal((await run(editRemark, { ...teacher(), params: { id: overall._id }, body: { text: "x" } })).code, 404);
  assert.equal((await run(releaseRemarks, { ...teacher(), body: { ids: [overall._id], release: true } })).out.updated, 0);
});

test("remarks: the class list shows each student with their latest remark", async () => {
  stub();
  await run(generateRemarks, { ...teacher(), body: { classId: CLASS, subjectId: SUBJ } });
  const l = await run(listRemarks, { ...teacher(), query: { classId: CLASS, subjectId: SUBJ } });
  assert.equal(l.out.students.length, 5);
  assert.ok(l.out.students.every((s: any) => s.review && s.review.status === "draft"));
});

// ---------------------------------------------------------------- Phase 4: staff indicators
test("grading stats: median days, backlog and oldest wait", () => {
  const now = Date.now();
  const g = gradingStats([
    { submittedAt: new Date(now - 5 * day), gradedAt: new Date(now - 4 * day) },
    { submittedAt: new Date(now - 6 * day), gradedAt: new Date(now - 3 * day) },
    { submittedAt: new Date(now - 10 * day), gradedAt: null }
  ], now);
  assert.equal(g.markedCount, 2);
  assert.equal(g.medianDays, 2);
  assert.equal(g.waiting, 1);
  assert.equal(g.oldestWaitingDays, 10);
  assert.equal(median([]), null);
});

test("signals: fair rules; thin data produces no verdicts", () => {
  const none = { medianDays: null, markedCount: 0, waiting: 0, oldestWaitingDays: null };
  const base = { hasSubjects: true, periodDays: 90, examsSet: 4, participation: 75, participationExams: 4, grading: none, classes: [], remarks: { released: 0, students: 0 } };
  assert.equal(buildSignals(base).length, 0);
  assert.equal(buildSignals({ ...base, examsSet: 0 })[0].level, "attention");
  assert.equal(buildSignals({ ...base, grading: { ...none, waiting: 3, oldestWaitingDays: 9 } })[0].level, "attention");
  const slow = buildSignals({ ...base, grading: { medianDays: 8, markedCount: 6, waiting: 0, oldestWaitingDays: null } });
  assert.match(slow[0].text, /about 8 days to mark/);
  assert.equal(buildSignals({ ...base, grading: { medianDays: 9, markedCount: 2, waiting: 0, oldestWaitingDays: null } }).length, 0); // 2 papers is too few
  assert.equal(buildSignals({ ...base, participation: 50 })[0].level, "watch");   // low turnout is a 'watch', not blame
  assert.equal(buildSignals({ ...base, participation: 50, participationExams: 2 }).length, 0);
  const fall = buildSignals({ ...base, classes: [{ className: "P5", subjectName: "Maths", exams: 4, trend: "down" }] });
  assert.equal(fall[0].level, "watch");
  assert.match(fall[0].text, /before drawing conclusions/);
  assert.equal(buildSignals({ ...base, classes: [{ className: "P5", subjectName: "Maths", exams: 2, trend: "down" }] }).length, 0);
});

test("staff: admin sees every teacher alphabetically; a teacher sees only themselves", async () => {
  stub();
  const asAdmin = await run(getStaffIndicators, { ...admin, query: {} });
  assert.deepEqual(asAdmin.out.teachers.map((t: any) => t.name), ["Mr Other", "Mrs Teacher"]);
  assert.ok(asAdmin.out.note.includes("not scores"));
  const asTeacher = await run(getStaffIndicators, { ...teacher(), query: {} });
  assert.deepEqual(asTeacher.out.teachers.map((t: any) => t.name), ["Mrs Teacher"]);
});

test("staff: marking backlog, participation and class trend come from that teacher's own exams", async () => {
  const old = exams.map((e) => attempt(e, "s5", 4, { needsGrading: true, submittedAt: new Date(Date.now() - 12 * day) }));
  stub({ attempts: [...attempts.filter((a) => a.studentId !== "s5"), ...old] });
  const { out } = await run(getStaffIndicators, { ...admin, query: {} });
  const t = out.teachers.find((x: any) => x.name === "Mrs Teacher");
  assert.equal(t.examsSet, 3);
  assert.equal(t.grading.waiting, 3);
  assert.ok(t.grading.oldestWaitingDays >= 12);
  assert.ok(t.signals.some((s: any) => s.level === "attention" && /waiting for theory marking/.test(s.text)));
  assert.equal(t.classes.length, 1);
  const other = out.teachers.find((x: any) => x.name === "Mr Other");
  assert.equal(other.examsSet, 0);
  assert.equal(other.signals.length, 0);   // no subjects assigned, so "no exams set" is not raised
});
