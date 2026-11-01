import { Request, Response } from "express";
import { DEFAULT_PRICE_PER_STUDENT, MIN_TERM_FEE, TERM_DAYS, MAX_TERMS_PER_PAYMENT, onlinePaymentsEnabled } from "../utils/billingConfig";
import { TRIAL_DAYS } from "../utils/schoolAccess";

// Public (no login): the numbers the Pricing page shows, read from the same settings
// the billing code uses, so the page can never disagree with what schools are charged.
export function getPublicPricing(_req: Request, res: Response) {
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    currency: "NGN",
    pricePerStudentPerTerm: DEFAULT_PRICE_PER_STUDENT,
    minTermFee: MIN_TERM_FEE,
    termDays: TERM_DAYS,
    trialDays: TRIAL_DAYS,
    maxTermsPerPayment: MAX_TERMS_PER_PAYMENT,
    onlinePaymentsEnabled: onlinePaymentsEnabled()
  });
}
