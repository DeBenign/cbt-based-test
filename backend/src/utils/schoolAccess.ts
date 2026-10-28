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

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AccessExpiry {
  kind: "paid" | "trial";   // which period is the one that ends last
  endsAt: Date;
  daysLeft: number;         // whole days, rounded up; 0 or negative once it has ended
}

// When does this school's access run out? Whichever of trial / paid time ends last.
export function accessExpiry(school: ISchool, now = Date.now()): AccessExpiry {
  const trialEnd = school.trialEndsAt ? school.trialEndsAt.getTime() : now;
  const paidEnd = school.subscriptionPaidUntil ? school.subscriptionPaidUntil.getTime() : 0;
  const kind = paidEnd > trialEnd ? "paid" : "trial";
  const endsAt = new Date(Math.max(trialEnd, paidEnd));
  return { kind, endsAt, daysLeft: Math.ceil((endsAt.getTime() - now) / DAY_MS) };
}
