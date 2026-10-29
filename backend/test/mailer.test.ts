import test from "node:test";
import assert from "node:assert/strict";
import { mailProvider } from "../src/services/mailer";

const from = "Benchmark CBT <a@b.com>";

test("no MAIL_FROM means email is off, whatever else is set", () => {
  assert.equal(mailProvider({ SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASS: "p", RESEND_API_KEY: "k" } as any), null);
});
test("SMTP needs host, user and password", () => {
  assert.equal(mailProvider({ MAIL_FROM: from, SMTP_HOST: "h", SMTP_USER: "u" } as any), null);
  assert.equal(mailProvider({ MAIL_FROM: from, SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASS: "p" } as any), "smtp");
});
test("Resend is used when only its key is set; SMTP wins when both are", () => {
  assert.equal(mailProvider({ MAIL_FROM: from, RESEND_API_KEY: "k" } as any), "resend");
  assert.equal(mailProvider({ MAIL_FROM: from, RESEND_API_KEY: "k", SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASS: "p" } as any), "smtp");
});
