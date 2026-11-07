import { Schema, model, Document, Types } from "mongoose";

// One row per call to the AI. This is the school's monthly allowance meter,
// the platform owner's cost record, and the base for a generation history.
export interface IAiUsage extends Document {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
  curriculumId?: Types.ObjectId;
  kind: "generate" | "regenerate";
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;     // estimated from the price table in services/aiUsage.ts
  requested: number;   // questions asked for
  saved: number;       // questions that passed validation and were kept (what counts against the allowance)
  rejected: number;
  summary?: string;                    // e.g. "Primary 5 · Mathematics · Term 1 scheme", shown in the history list
  params?: Record<string, unknown>;    // the settings used, so a teacher can run the same thing again
  createdAt: Date;
}

const aiUsageSchema = new Schema<IAiUsage>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum" },
  kind: { type: String, enum: ["generate", "regenerate"], required: true },
  modelName: { type: String, required: true },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  costUsd: { type: Number, default: 0 },
  requested: { type: Number, default: 0 },
  saved: { type: Number, default: 0 },
  rejected: { type: Number, default: 0 },
  summary: String,
  params: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

aiUsageSchema.index({ schoolId: 1, createdAt: -1 });

export default model<IAiUsage>("AiUsage", aiUsageSchema);
