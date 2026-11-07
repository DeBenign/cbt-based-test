import { Schema, model, Document, Types } from "mongoose";

export const REPORT_REASONS = ["wrong_answer", "unclear", "off_curriculum", "wrong_level", "duplicate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

// A teacher saying "this AI question is bad". A copy of the question is kept, so the report
// still makes sense after the draft is discarded or regenerated.
export interface IQuestionReport extends Document {
  schoolId: Types.ObjectId;
  questionId: Types.ObjectId;
  reporterId: Types.ObjectId;
  generationId?: Types.ObjectId;
  modelName?: string;
  reason: ReportReason;
  note?: string;
  snapshot: Record<string, unknown>;
  status: "open" | "resolved";
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  createdAt: Date;
}

const questionReportSchema = new Schema<IQuestionReport>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  questionId: { type: Schema.Types.ObjectId, required: true },
  reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  generationId: { type: Schema.Types.ObjectId, ref: "AiUsage" },
  modelName: String,
  reason: { type: String, enum: REPORT_REASONS, required: true },
  note: String,
  snapshot: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ["open", "resolved"], default: "open" },
  resolvedAt: Date,
  resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now }
});

questionReportSchema.index({ status: 1, createdAt: -1 });
questionReportSchema.index({ questionId: 1, reporterId: 1, status: 1 });

export default model<IQuestionReport>("QuestionReport", questionReportSchema);
