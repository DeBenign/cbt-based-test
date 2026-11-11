import { Schema, model, Document, Types } from "mongoose";

// A written remark about a student. "subject" remarks belong to the subject teacher; the "overall"
// remark belongs to the school admin (the proprietor's remark on a report card). A remark is drafted
// from the exam numbers, edited by a person, and students see it only once it is released.
export interface IRemark extends Document {
  schoolId: Types.ObjectId;
  kind: "subject" | "overall";
  studentId: Types.ObjectId;
  classId: Types.ObjectId;
  subjectId?: Types.ObjectId;
  authorId: Types.ObjectId;
  facts: Record<string, unknown>; // the numbers this draft was written from
  draftText: string;              // what the system wrote
  text: string;                   // what will be shown (draftText unless a person edited it)
  edited: boolean;
  status: "draft" | "released";
  releasedAt?: Date;
  createdAt: Date;
}

const remarkSchema = new Schema<IRemark>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  kind: { type: String, enum: ["subject", "overall"], required: true },
  studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
  authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  facts: { type: Schema.Types.Mixed, default: {} },
  draftText: { type: String, required: true },
  text: { type: String, required: true },
  edited: { type: Boolean, default: false },
  status: { type: String, enum: ["draft", "released"], default: "draft" },
  releasedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

remarkSchema.index({ schoolId: 1, kind: 1, studentId: 1, subjectId: 1, createdAt: -1 });

export default model<IRemark>("Remark", remarkSchema);
