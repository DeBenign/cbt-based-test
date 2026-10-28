import { Schema, model, Document } from "mongoose";

export interface ISchoolBranding {
  logoUrl?: string;
  primaryColor?: string;
}

export interface ISchool extends Document {
  name: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  trialEndsAt: Date;
  subscriptionStatus: "trial" | "active" | "expired";
  subscriptionPaidUntil?: Date;
  pricePerStudent?: number; // optional per-school override of the default per-student term price
  branding: ISchoolBranding;
  reminderKeysSent?: string[]; // which expiry reminders have already been emailed
}

const schoolSchema = new Schema<ISchool>({
  name: { type: String, required: true },
  address: String,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  trialEndsAt: { type: Date, required: true },
  subscriptionStatus: { type: String, enum: ["trial", "active", "expired"], default: "trial" },
  subscriptionPaidUntil: Date,
  pricePerStudent: Number,
  branding: {
    logoUrl: String,
    primaryColor: String
  },
  reminderKeysSent: { type: [String], default: [] }
});

export default model<ISchool>("School", schoolSchema);