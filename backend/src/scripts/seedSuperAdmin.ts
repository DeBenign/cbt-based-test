import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import User from "../models/User";

dotenv.config();

const SUPERADMIN = {
  name: process.env.SUPERADMIN_NAME || "Super Admin",
  email: process.env.SUPERADMIN_EMAIL || "",
  password: process.env.SUPERADMIN_PASSWORD || ""
};

async function run() {
  if (!SUPERADMIN.email || !SUPERADMIN.password) {
    console.error("Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in backend/.env before running this.");
    process.exit(1);
  }

  await connectDB();

  const existing = await User.findOne({ email: SUPERADMIN.email });
  if (existing) {
    console.log(`Superadmin already exists: ${SUPERADMIN.email}`);
  } else {
    const passwordHash = await bcrypt.hash(SUPERADMIN.password, 10);
    await User.create({
      name: SUPERADMIN.name,
      email: SUPERADMIN.email,
      passwordHash,
      role: "superadmin"
    });
    console.log(`Created superadmin: ${SUPERADMIN.email}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Superadmin bootstrap failed:", err);
  process.exit(1);
});