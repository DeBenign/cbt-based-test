import School from "../models/School";
import Payment from "../models/Payment";
import { TERM_DAYS } from "../utils/billingConfig";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function applyPayment(params: {
  schoolId: string;
  amount: number;
  reference: string;
  terms: number;
  termLabel?: string;
  paidUntil?: Date; // optional exact end date, to line access up with the school's real term end
  method: "nomba" | "manual";
  confirmedBy?: string;
}): Promise<{ subscriptionPaidUntil: Date } | { alreadyProcessed: true }> {
  const existingRef = await Payment.findOne({ reference: params.reference });
  if (existingRef) return { alreadyProcessed: true };

  const school = await School.findById(params.schoolId);
  if (!school) throw new Error("School not found");

  // Paying early never loses time: a new term stacks on top of any paid time left.
  const base = school.subscriptionPaidUntil && school.subscriptionPaidUntil.getTime() > Date.now()
    ? school.subscriptionPaidUntil
    : new Date();

  let paidUntil = new Date(base.getTime() + params.terms * TERM_DAYS * DAY_MS);
  if (params.paidUntil) {
    if (params.paidUntil.getTime() <= Date.now()) throw new Error("The access-until date must be in the future");
    paidUntil = params.paidUntil;
  }

  await Payment.create({
    schoolId: school._id,
    amount: params.amount,
    reference: params.reference,
    method: params.method,
    terms: params.terms,
    termLabel: params.termLabel,
    confirmedBy: params.confirmedBy
  });

  school.subscriptionPaidUntil = paidUntil;
  school.subscriptionStatus = "active";
  await school.save();

  return { subscriptionPaidUntil: paidUntil };
}
