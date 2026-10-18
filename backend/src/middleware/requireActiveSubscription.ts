import { Response, NextFunction } from "express";
import { AuthedRequest } from "./auth";
import School from "../models/School";
import { ensureTrialDates, getAccessStatus } from "../utils/schoolAccess";

export async function requireActiveSubscription(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user!.schoolId) return next();

  const school = await School.findById(req.user!.schoolId);
  if (!school) return res.status(404).json({ error: "School not found" });

  await ensureTrialDates(school);
  const { trialActive, paidActive } = getAccessStatus(school);

  if (!trialActive && !paidActive) {
    return res.status(402).json({
      error: "Your school's free trial has ended. Please complete payment to continue.",
      accessBlocked: true
    });
  }

  next();
}