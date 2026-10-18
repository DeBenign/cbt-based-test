import { Schema, model, Document, Types } from "mongoose";

export interface ISubject extends Document {
  schoolId: Types.ObjectId;
  name: string;
  classIds: Types.ObjectId[];
}

const subjectSchema = new Schema<ISubject>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  name: { type: String, required: true },
  classIds: [{ type: Schema.Types.ObjectId, ref: "Class" }]
});
subjectSchema.index({ schoolId: 1, name: 1 }, { unique: true });

export default model<ISubject>("Subject", subjectSchema);
