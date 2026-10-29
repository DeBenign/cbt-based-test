import "dotenv/config";
import fs from "fs";
import path from "path";
import { mailProvider, sendMail, verifyMail } from "../services/mailer";

// Usage: npm run test:mail -- someone@example.com
// Tells you exactly which settings are missing (names only, never the values).
function explainMissingSettings() {
  const envFile = path.resolve(process.cwd(), ".env");
  console.error(fs.existsSync(envFile)
    ? `Found ${envFile}, but email settings are missing from it.`
    : `No .env file at ${envFile}. Run this from the backend folder, and make sure the file is named exactly ".env" (not ".env.txt" or ".env.example").`);

  const need = process.env.RESEND_API_KEY && !process.env.SMTP_HOST
    ? ["MAIL_FROM", "RESEND_API_KEY"]
    : ["MAIL_FROM", "SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) console.error(`Missing or empty: ${missing.join(", ")}`);
  console.error('Each line looks like  SMTP_HOST=smtp.gmail.com  (no spaces around "=", no "#" at the start). Save the file and run again.');
}

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("Give an address to send to:  npm run test:mail -- you@example.com");
    process.exit(1);
  }
  if (!mailProvider()) {
    explainMissingSettings();
    process.exit(1);
  }
  const provider = await verifyMail();
  console.log(`Settings look good (sending with ${provider}). Sending to ${to}...`);
  await sendMail({
    to,
    subject: "Benchmark CBT test email",
    text: "If you can read this, email from Benchmark CBT works. Password-reset links and expiry reminders will reach people."
  });
  console.log("Sent. Check the inbox (and the spam folder).");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
