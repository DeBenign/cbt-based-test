import { ISchool } from "../models/School";

const TRIAL_DAYS = 90;

// Self-heals any school document created before trialEndsAt existed. Safer
// than relying on someone running a one-off migration script -- that's
// exactly the gap that caused today's 500s on login and question saves.
export async function ensureTrialDates(school: ISchool): Promise<void> {
  if (!school.trialEndsAt) {
    school.trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    await school.save();
  }
}

export function getAccessStatus(school: ISchool): { trialActive: boolean; paidActive: boolean } {
  const now = Date.now();
  const trialActive = school.trialEndsAt ? school.trialEndsAt.getTime() > now : true;
  const paidActive = !!school.subscriptionPaidUntil && school.subscriptionPaidUntil.getTime() > now;
  return { trialActive, paidActive };
}