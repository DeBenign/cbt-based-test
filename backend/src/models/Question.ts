import { Schema, model, Document, Types } from "mongoose";

export interface IOption {
  text: string;
  isCorrect: boolean;
}

export interface IQuestion extends Document {
  schoolId: Types.ObjectId;
  subjectId: Types.ObjectId;
  classId: Types.ObjectId; 
  topic: string;
  type: "mcq" | "theory"; // MVP only creates "mcq"
  difficulty: "easy" | "medium" | "hard";
  questionText: string;
  imageUrl?: string;
  options: IOption[]; // used when type === "mcq"
  correctAnswerText?: string; // used when type === "theory"
  marks: number;
  curriculumTag?: string; // e.g. "WAEC-2024-Bio-Genetics"
  reviewStatus: "draft" | "approved"; // AI-generated questions start as "draft" until a teacher approves them
  source: "manual" | "ai";
  curriculumId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const optionSchema = new Schema<IOption>(
  {
    text: { type: String, required: true },
    isCorrect: { type: Boolean, required: true, default: false }
  },
  { _id: false }
);

const questionSchema = new Schema<IQuestion>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
  topic: { type: String, required: true },
  type: { type: String, enum: ["mcq", "theory"], default: "mcq" },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
  questionText: { type: String, required: true },
  imageUrl: String,
  options: [optionSchema],
  correctAnswerText: String,
  marks: { type: Number, required: true, default: 1 },
  curriculumTag: String,
  reviewStatus: { type: String, enum: ["draft", "approved"], default: "approved" },
  source: { type: String, enum: ["manual", "ai"], default: "manual" },
  curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum" },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now }
});

export default model<IQuestion>("Question", questionSchema);
