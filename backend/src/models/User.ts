import { Schema, model, Document, Types } from "mongoose";

export type UserRole = "superadmin" | "admin" | "teacher" | "student";

export interface IUser extends Document {
  schoolId?: Types.ObjectId;  // superadmin has none
  name: string;
  email: string;
  username?: string; // auto-generated for bulk-created accounts; usable instead of email at login
  mustChangePassword?: boolean;
  passwordHash: string;
  role: UserRole;
  classId?: Types.ObjectId;
  subjectIds?: Types.ObjectId[];
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School" },   // required: true removed
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  username: { type: String, lowercase: true, unique: true, sparse: true },
  mustChangePassword: { type: Boolean, default: false },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["superadmin", "admin", "teacher", "student"], required: true },
  classId: { type: Schema.Types.ObjectId, ref: "Class" },
  subjectIds: [{ type: Schema.Types.ObjectId, ref: "Subject" }],
  createdAt: { type: Date, default: Date.now }
});

export default model<IUser>("User", userSchema);