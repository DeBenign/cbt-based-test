import { Schema, model, Document, Types } from "mongoose";

export type ExamStatus = "draft" | "scheduled" | "live" | "closed";

export interface IExam extends Document {
  schoolId: Types.ObjectId;
  subjectId: Types.ObjectId;
  classId: Types.ObjectId;
  title: string;
  questionIds: Types.ObjectId[];
  duration: number; // minutes
  startTime: Date;
  endTime: Date;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  lockdownRequired: boolean;
  status: ExamStatus;
  createdBy: Types.ObjectId;
}

const examSchema = new Schema<IExam>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
  classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
  title: { type: String, required: true },
  questionIds: [{ type: Schema.Types.ObjectId, ref: "Question" }],
  duration: { type: Number, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  randomizeQuestions: { type: Boolean, default: true },
  randomizeOptions: { type: Boolean, default: true },
  lockdownRequired: { type: Boolean, default: false },
  status: { type: String, enum: ["draft", "scheduled", "live", "closed"], default: "draft" },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
});

export default model<IExam>("Exam", examSchema);
