// Subscription pricing is per student, per school term.
// All three numbers are PLACEHOLDERS you can change without touching code:
// set the env vars on the backend (Vercel -> Settings -> Environment Variables).

// How long one paid term of access lasts: 90 days (about 3 months). Set TERM_DAYS on the
// backend to change it. NOTE: a TERM_DAYS value in Vercel wins over this default.
export const TERM_DAYS = Number(process.env.TERM_DAYS) || 90;

// Default fee per student per term (naira). A school can be given its own price
// by the superadmin (School.pricePerStudent), e.g. a negotiated discount.
export const DEFAULT_PRICE_PER_STUDENT = Number(process.env.PRICE_PER_STUDENT_PER_TERM) || 500;

// A school never pays less than this per term, however few students it has.
export const MIN_TERM_FEE = Number(process.env.MIN_TERM_FEE) || 15000;

export const MAX_TERMS_PER_PAYMENT = 3; // one full school year

export function effectivePrice(pricePerStudent?: number | null): number {
  return typeof pricePerStudent === "number" && pricePerStudent > 0 ? pricePerStudent : DEFAULT_PRICE_PER_STUDENT;
}

export function termFee(studentCount: number, pricePerStudent?: number | null): number {
  return Math.max(MIN_TERM_FEE, Math.round(studentCount * effectivePrice(pricePerStudent)));
}

// Online (Nomba) payments stay off until you set ONLINE_PAYMENTS_ENABLED=true,
// so schools are never sent to a checkout that doesn't work yet.
export function onlinePaymentsEnabled(): boolean {
  return process.env.ONLINE_PAYMENTS_ENABLED === "true" && !!process.env.NOMBA_CLIENT_ID;
}
