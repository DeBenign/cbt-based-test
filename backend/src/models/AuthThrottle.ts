import { Schema, model, Document } from "mongoose";

// One row per throttle key (e.g. "this username from this IP"). Stored in
// MongoDB rather than memory because serverless instances don't share memory:
// an in-memory counter would reset constantly and could be dodged.
export interface IAuthThrottle extends Document {
  key: string;
  count: number;
  expiresAt: Date;
}

const authThrottleSchema = new Schema<IAuthThrottle>({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true }
});
// MongoDB deletes the row itself once expiresAt passes.
authThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model<IAuthThrottle>("AuthThrottle", authThrottleSchema);
