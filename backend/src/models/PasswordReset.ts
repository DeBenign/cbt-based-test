import { Schema, model, Document, Types } from "mongoose";

// Only a SHA-256 hash of the emailed token is stored, so a database leak
// doesn't hand out working reset links.
export interface IPasswordReset extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
}

const passwordResetSchema = new Schema<IPasswordReset>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  usedAt: Date
});
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model<IPasswordReset>("PasswordReset", passwordResetSchema);
