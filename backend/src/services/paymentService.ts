import School from "../models/School";
import Payment, { IPayment } from "../models/Payment";
import AuditLog from "../models/AuditLog";
import { TERM_DAYS } from "../utils/billingConfig";
import { nextReceiptNo } from "../utils/receipt";
import { clearAccountCache } from "../utils/accountCheck";

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
}): Promise<{ subscriptionPaidUntil: Date; paymentId: string; receiptNo: string } | { alreadyProcessed: true }> {
  const existingRef = await Payment.findOne({ reference: params.reference });
  if (existingRef) return { alreadyProcessed: true };

  const school = await School.findById(params.schoolId);
  if (!school) throw new Error("School not found");

  const before = school.subscriptionPaidUntil ?? null;

  // Paying early never loses time: a new term stacks on top of any paid time left.
  const base = before && before.getTime() > Date.now() ? before : new Date();

  let paidUntil = new Date(base.getTime() + params.terms * TERM_DAYS * DAY_MS);
  if (params.paidUntil) {
    if (params.paidUntil.getTime() <= Date.now()) throw new Error("The access-until date must be in the future");
    paidUntil = params.paidUntil;
  }

  const receiptNo = await nextReceiptNo();
  const payment = await Payment.create({
    schoolId: school._id,
    amount: params.amount,
    reference: params.reference,
    method: params.method,
    terms: params.terms,
    termLabel: params.termLabel,
    confirmedBy: params.confirmedBy,
    receiptNo,
    paidUntilBefore: before,
    paidUntilAfter: paidUntil
  });

  school.subscriptionPaidUntil = paidUntil;
  school.subscriptionStatus = "active";
  await school.save();

  return { subscriptionPaidUntil: paidUntil, paymentId: payment._id.toString(), receiptNo };
}

// ---- undo ----

export type VoidCheck = { ok: true } | { ok: false; error: string };

// Only the most recent payment can be undone: later payments stack on top of it,
// so undoing an older one would leave the access date wrong.
export function checkVoidable(
  payment: Pick<IPayment, "status" | "method" | "paidUntilAfter">,
  isLatestApplied: boolean,
  latestReceiptNo: string | undefined,
  schoolPaidUntil: Date | undefined
): VoidCheck {
  if (payment.status === "voided") return { ok: false, error: "This payment is already cancelled." };
  if (payment.method !== "manual") {
    return { ok: false, error: "Online (Nomba) payments can't be cancelled here — that money has to be refunded through Nomba." };
  }
  if (!payment.paidUntilAfter) {
    return { ok: false, error: "This payment was recorded before cancelling was possible, so it can't be undone automatically." };
  }
  if (!isLatestApplied) {
    return { ok: false, error: `Cancel the more recent payment first${latestReceiptNo ? ` (receipt ${latestReceiptNo})` : ""}.` };
  }
  if (!schoolPaidUntil || schoolPaidUntil.getTime() !== payment.paidUntilAfter.getTime()) {
    return { ok: false, error: "The school's access date has changed since this payment, so it can't be undone safely." };
  }
  return { ok: true };
}

export async function voidPayment(params: {
  schoolId: string;
  paymentId: string;
  reason: string;
  voidedBy: string;
}): Promise<{ subscriptionPaidUntil: Date | null } | { error: string; status: number }> {
  const school = await School.findById(params.schoolId);
  if (!school) return { error: "School not found", status: 404 };
  const payment = await Payment.findOne({ _id: params.paymentId, schoolId: school._id });
  if (!payment) return { error: "Payment not found", status: 404 };

  const latest = await Payment.findOne({ schoolId: school._id, status: { $ne: "voided" } }).sort({ confirmedAt: -1, _id: -1 });
  const check = checkVoidable(
    payment,
    !!latest && latest._id.equals(payment._id),
    latest?.receiptNo,
    school.subscriptionPaidUntil
  );
  if (!check.ok) return { error: check.error, status: 400 };

  // Claim first (atomic), so two clicks can't undo the same payment twice.
  const originalReference = payment.reference;
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: "voided" } },
    {
      $set: {
        status: "voided",
        voidedAt: new Date(),
        voidedBy: params.voidedBy,
        voidReason: params.reason,
        originalReference,
        reference: `${originalReference}#voided-${payment._id.toString().slice(-6)}` // frees the reference for the corrected entry
      }
    }
  );
  if (!claimed) return { error: "This payment is already cancelled.", status: 409 };

  const restored = payment.paidUntilBefore ?? null;
  const paidStillActive = !!restored && restored.getTime() > Date.now();
  school.subscriptionPaidUntil = restored ?? undefined;
  school.subscriptionStatus = paidStillActive ? "active" : school.trialEndsAt.getTime() > Date.now() ? "trial" : "expired";
  await school.save();
  clearAccountCache();

  try {
    await AuditLog.create({
      schoolId: school._id,
      actorId: params.voidedBy,
      actorRole: "superadmin",
      action: "billing.void_payment",
      summary: `A payment of ₦${payment.amount.toLocaleString()} (receipt ${payment.receiptNo ?? "n/a"}) was cancelled`,
      entityType: "payment",
      entityId: payment._id.toString()
    });
  } catch (err) {
    console.error("audit log write failed", err);
  }

  return { subscriptionPaidUntil: restored };
}
