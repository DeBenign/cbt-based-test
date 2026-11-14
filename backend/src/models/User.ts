import { Schema, model, Document, Types } from "mongoose";

export type UserRole = "superadmin" | "admin" | "teacher" | "student";

export interface IUser extends Document {
  schoolId?: Types.ObjectId;  // superadmin has none
  name: string;
  email: string;
  username?: string; // auto-generated for bulk-created accounts; usable instead of email at login
  mustChangePassword?: boolean;
  passwordChangedAt?: Date; // sessions signed in before this moment are no longer valid
  passwordHash: string;
  role: UserRole;
  classId?: Types.ObjectId;
  subjectIds?: Types.ObjectId[];
  classIds?: Types.ObjectId[]; // teachers only: the classes they teach (empty = none, until the admin assigns them)
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School" },   // required: true removed
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  username: { type: String, lowercase: true, unique: true, sparse: true },
  mustChangePassword: { type: Boolean, default: false },
  passwordChangedAt: Date,
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["superadmin", "admin", "teacher", "student"], required: true },
  classId: { type: Schema.Types.ObjectId, ref: "Class" },
  subjectIds: [{ type: Schema.Types.ObjectId, ref: "Subject" }],
  classIds: [{ type: Schema.Types.ObjectId, ref: "Class" }],
  createdAt: { type: Date, default: Date.now }
});

// Roster, login-sheet and teacher lookups are always per school.
userSchema.index({ schoolId: 1, role: 1, createdAt: -1 });
userSchema.index({ schoolId: 1, classId: 1 });

export default model<IUser>("User", userSchema);