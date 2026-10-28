import Counter from "../models/Counter";
import { IPayment } from "../models/Payment";

export function formatReceiptNo(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(5, "0")}`;
}

// Sequential per calendar year, allocated atomically.
export async function nextReceiptNo(now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const counter = await Counter.findOneAndUpdate(
    { _id: `receipt-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return formatReceiptNo(process.env.RECEIPT_PREFIX || "BMK", year, counter!.seq);
}

// Payments recorded before receipts existed get a number the first time one is opened.
export async function ensureReceiptNo(payment: IPayment): Promise<string> {
  if (payment.receiptNo) return payment.receiptNo;
  payment.receiptNo = await nextReceiptNo(payment.confirmedAt);
  await payment.save();
  return payment.receiptNo;
}

export function buildReceipt(
  payment: IPayment,
  school: { name: string; address?: string },
  opts: { includeVoidReason: boolean }
) {
  const voided = payment.status === "voided";
  return {
    receiptNo: payment.receiptNo,
    issuedAt: payment.confirmedAt,
    issuer: {
      name: process.env.RECEIPT_ISSUER_NAME || "Benchmark CBT",
      contact: process.env.RECEIPT_ISSUER_CONTACT || ""
    },
    school: { name: school.name, address: school.address || "" },
    amount: payment.amount,
    currency: "NGN",
    method: payment.method,
    reference: voided ? payment.originalReference || payment.reference : payment.reference,
    terms: payment.terms ?? null,
    termLabel: payment.termLabel ?? null,
    accessUntil: payment.paidUntilAfter ?? null,
    status: payment.status,
    voidedAt: voided ? payment.voidedAt ?? null : null,
    voidReason: voided && opts.includeVoidReason ? payment.voidReason ?? null : null
  };
}
