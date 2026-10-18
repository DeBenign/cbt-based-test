import type { VercelRequest, VercelResponse } from "@vercel/node";
import dotenv from "dotenv";
dotenv.config();

import app from "../src/app";
import { connectDB } from "../src/config/db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDB();
  return (app as any)(req, res);
}