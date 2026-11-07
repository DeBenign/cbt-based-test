import test from "node:test";
import assert from "node:assert/strict";
import { buildRoster } from "../src/services/examRoster";
import { buildWrongAnswerAlert } from "../src/services/reportAlert";
import { missingMailSettings } from "../src/services/mailer";
import { TERM_DAYS } from "../src/utils/billingConfig";

const att = (id: string, name: string, score: number, status: any = "submitted"): any => ({ studentId: id, studentName: name, score, status });
const klass = [{ id: "1", name: "Ada" }, { id: "2", name: "Bayo" }, { id: "3", name: "Chidi" }, { id: "4", name: "Dayo" }];

test("students who never started appear as absent with 0", () => {
  const r = buildRoster([att("1", "Ada", 8), att("2", "Bayo", 6)], klass, 10);
  assert.equal(r.classSize, 4);
  assert.equal(r.submittedCount, 2);
  assert.equal(r.absentCount, 2);
  const absent = r.rows.filter((x) => x.status === "absent");
  assert.deepEqual(absent.map((x) => x.studentName), ["Chidi", "Dayo"]);
  assert.ok(absent.every((x) => x.score === 0 && x.submittedAt === null && x.totalMarks === 10));
});
test("class average counts absentees as 0; attempted average does not", () => {
  const r = buildRoster([att("1", "Ada", 8), att("2", "Bayo", 6)], klass, 10);
  assert.equal(r.classAverage, 3.5);       // (8+6+0+0)/4
  assert.equal(r.attemptedAverage, 7);     // (8+6)/2
});
test("a student who sat it and scored 0 is not marked absent", () => {
  const r = buildRoster([att("3", "Chidi", 0)], klass, 10);
  assert.equal(r.rows.find((x) => x.studentId === "3")!.status, "submitted");
  assert.equal(r.absentCount, 3);
});
test("a student who attempted but has left the class is still listed once", () => {
  const r = buildRoster([att("9", "Old Student", 5)], klass, 10);
  assert.equal(r.rows.filter((x) => x.studentName === "Old Student").length, 1);
  assert.equal(r.classSize, 5);
});
test("attempted students come first, best score first, absentees last", () => {
  const r = buildRoster([att("2", "Bayo", 3), att("1", "Ada", 9)], klass, 10);
  assert.deepEqual(r.rows.map((x) => x.studentName), ["Ada", "Bayo", "Chidi", "Dayo"]);
});
test("an empty class with no attempts gives zeros, not NaN", () => {
  const r = buildRoster([], [], 10);
  assert.equal(r.classAverage, 0);
  assert.equal(r.attemptedAverage, 0);
});

test("a term is 90 days by default", () => {
  if (!process.env.TERM_DAYS) assert.equal(TERM_DAYS, 90);
});

test("mail diagnostics list setting names, never values", () => {
  assert.deepEqual(missingMailSettings({} as any), ["MAIL_FROM", "SMTP_HOST", "SMTP_USER", "SMTP_PASS (or RESEND_API_KEY instead)"]);
  assert.deepEqual(missingMailSettings({ MAIL_FROM: "a@b.c", SMTP_HOST: "h", SMTP_USER: "u" } as any), ["SMTP_PASS"]);
  assert.deepEqual(missingMailSettings({ MAIL_FROM: "a@b.c", RESEND_API_KEY: "k" } as any), []);
});

test("wrong-answer alert names the teacher, school, marked answer and escapes HTML", () => {
  const m = buildWrongAnswerAlert({
    schoolName: "Test <Academy>", teacherName: "Ada", questionText: "2+2?",
    options: [{ text: "3", isCorrect: true }, { text: "4", isCorrect: false }],
    note: "It is 4", modelName: "claude-haiku-5-5", aiCheck: "disagreed", frontendUrl: "https://x.app"
  });
  assert.equal(m.subject, "AI question reported as wrong: Test <Academy>");
  assert.match(m.text, /A\. 3  <- marked correct/);
  assert.match(m.text, /flagged it too \(disagreed\)/);
  assert.match(m.text, /https:\/\/x\.app\/superadmin\/ai-reports/);
  assert.match(m.html, /Test &lt;Academy&gt;/);
  assert.doesNotMatch(m.html, /Test <Academy>/);
});
