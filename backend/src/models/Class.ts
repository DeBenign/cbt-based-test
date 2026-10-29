import { Schema, model, Document, Types } from "mongoose";

// School section a class belongs to. Optional: older classes simply have none.
export const CLASS_LEVELS = ["nursery", "primary", "junior_secondary", "senior_secondary"] as const;
export type ClassLevel = (typeof CLASS_LEVELS)[number];

export interface IClass extends Document {
  schoolId: Types.ObjectId;
  name: string; // e.g. "JSS2A"
  academicYear: string; // e.g. "2025/2026"
  level?: ClassLevel;
}

const classSchema = new Schema<IClass>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  name: { type: String, required: true },
  academicYear: { type: String, required: true },
  level: { type: String, enum: CLASS_LEVELS }
});
classSchema.index({ schoolId: 1, name: 1 }, { unique: true });

export default model<IClass>("Class", classSchema);
