import { Schema, model, Document, Types } from "mongoose";

export interface IPayment extends Document {
  schoolId: Types.ObjectId;
  amount: number;
  reference: string;
  method: "nomba" | "manual";
  terms?: number;           // number of school terms this payment covers
  termLabel?: string;       // e.g. "2026/27 Term 1" -- shown on the school's payment history
  periodMonths?: number;    // legacy: payments recorded before billing moved to per-term
  confirmedBy?: Types.ObjectId;
  confirmedAt: Date;
  receiptNo?: string;
  // Recorded so a manual payment can be undone exactly (see voidPayment).
  paidUntilBefore?: Date | null;
  paidUntilAfter?: Date;
  status: "applied" | "voided";
  voidedAt?: Date;
  voidedBy?: Types.ObjectId;
  voidReason?: string;
  originalReference?: string; // a voided payment's reference is renamed so the number can be reused
}

const paymentSchema = new Schema<IPayment>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  amount: { type: Number, required: true },
  reference: { type: String, required: true, unique: true },
  method: { type: String, enum: ["nomba", "manual"], required: true },
  terms: { type: Number },
  termLabel: String,
  periodMonths: Number,
  confirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
  confirmedAt: { type: Date, default: Date.now },
  receiptNo: { type: String, unique: true, sparse: true },
  paidUntilBefore: { type: Date, default: undefined },
  paidUntilAfter: Date,
  status: { type: String, enum: ["applied", "voided"], default: "applied" },
  voidedAt: Date,
  voidedBy: { type: Schema.Types.ObjectId, ref: "User" },
  voidReason: String,
  originalReference: String
});
paymentSchema.index({ schoolId: 1, confirmedAt: -1 });

export default model<IPayment>("Payment", paymentSchema);