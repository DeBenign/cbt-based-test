import { Schema, model, Document, Types } from "mongoose";

export interface IClass extends Document {
  schoolId: Types.ObjectId;
  name: string; // e.g. "JSS2A"
  academicYear: string; // e.g. "2025/2026"
}

const classSchema = new Schema<IClass>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  name: { type: String, required: true },
  academicYear: { type: String, required: true }
});
classSchema.index({ schoolId: 1, name: 1 }, { unique: true });

export default model<IClass>("Class", classSchema);
