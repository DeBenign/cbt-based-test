import "dotenv/config";
import { sendMail, verifyMail } from "../services/mailer";

// Usage: npm run test:mail -- someone@example.com
async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("Give an address to send to:  npm run test:mail -- you@example.com");
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
