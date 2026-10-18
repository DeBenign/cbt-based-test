import { Schema, model, Document, Types } from "mongoose";

export type AttemptStatus = "in-progress" | "submitted" | "auto-submitted" | "flagged" | "pending-submit";

export interface IAnswer {
  questionId: Types.ObjectId;
  selectedOption?: string;
  answerText?: string;
  clientTimestamp: number;
  serverReceivedAt?: Date;
  marksAwarded?: number; // theory answers only -- set by a teacher via grading
  gradedAt?: Date;
}

export interface IFlaggedEvent {
  type: "tab-switch" | "window-blur" | "fullscreen-exit" | "disconnect" | "blocked-shortcut";
  timestamp: number;
  meta?: string;
}

export interface IExamAttempt extends Document {
  examId: Types.ObjectId;
  studentId: Types.ObjectId;
  questionOrder: Types.ObjectId[];
  startedAt: Date;
  serverEndTime: Date;
  submittedAt?: Date;
  status: AttemptStatus;
  answers: IAnswer[];
  flaggedEvents: IFlaggedEvent[];
  score?: number;
  needsGrading: boolean; // true if this attempt has an answered theory question not yet graded
  gradedBy?: Types.ObjectId;
}

const answerSchema = new Schema<IAnswer>(
  {
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    selectedOption: String,
    answerText: String,
    clientTimestamp: { type: Number, required: true },
    serverReceivedAt: Date,
    marksAwarded: Number,
    gradedAt: Date
  },
  { _id: false }
);

const flaggedEventSchema = new Schema<IFlaggedEvent>(
  {
    type: { type: String, required: true },
    timestamp: { type: Number, required: true },
    meta: String
  },
  { _id: false }
);

const examAttemptSchema = new Schema<IExamAttempt>({
  examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
  studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  questionOrder: [{ type: Schema.Types.ObjectId, ref: "Question" }],
  startedAt: { type: Date, required: true },
  serverEndTime: { type: Date, required: true },
  submittedAt: Date,
  status: {
    type: String,
    enum: ["in-progress", "submitted", "auto-submitted", "flagged", "pending-submit"],
    default: "in-progress"
  },
  answers: [answerSchema],
  flaggedEvents: [flaggedEventSchema],
  score: Number,
  needsGrading: { type: Boolean, default: false },
  gradedBy: { type: Schema.Types.ObjectId, ref: "User" }
});

export default model<IExamAttempt>("ExamAttempt", examAttemptSchema);