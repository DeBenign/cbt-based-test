import dotenv from "dotenv";
dotenv.config();
import { connectDB } from "../config/db";
import { backfillTeacherClasses } from "../services/backfillTeacherClasses";

(async () => {
  await connectDB();
  const { updated } = await backfillTeacherClasses();
  console.log(`Teachers updated: ${updated}`);
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
