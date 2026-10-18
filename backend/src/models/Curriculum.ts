import { Schema, model, Document, Types } from "mongoose";

export interface ICurriculumTopic {
  title: string;
  text: string;
}

export interface ICurriculum extends Document {
  schoolId: Types.ObjectId;
  classId: Types.ObjectId;
  subjectId: Types.ObjectId;
  title: string; // e.g. "JSS2 Basic Science - Term 1 scheme of work"
  fileName?: string;
  sourceType: "pdf" | "docx" | "text";
  charCount: number;
  topics: ICurriculumTopic[]; // the extracted text, split into sections the AI is given
  uploadedBy: Types.ObjectId;
  createdAt: Date;
}

const topicSchema = new Schema<ICurriculumTopic>(
  { title: { type: String, required: true }, text: { type: String, required: true } },
  { _id: false }
);

const curriculumSchema = new Schema<ICurriculum>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
  title: { type: String, required: true },
  fileName: String,
  sourceType: { type: String, enum: ["pdf", "docx", "text"], required: true },
  charCount: { type: Number, required: true },
  topics: [topicSchema],
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now }
});
curriculumSchema.index({ schoolId: 1, classId: 1, subjectId: 1 });

export default model<ICurriculum>("Curriculum", curriculumSchema);
