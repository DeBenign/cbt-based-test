import { Schema, model, Document, Types } from "mongoose";

export interface IAuditLog extends Document {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  actorRole: string;
  targetUserId?: Types.ObjectId; // set when an action is done TO someone (e.g. admin corrects a student's attempt)
  action: string;                // machine-readable, e.g. "exam.publish" or "admin.reopen_attempt"
  summary: string;               // human-readable line for the activity feed
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  actorRole: { type: String, required: true },
  targetUserId: { type: Schema.Types.ObjectId, ref: "User" },
  action: { type: String, required: true },
  summary: { type: String, required: true },
  entityType: String,
  entityId: String,
  meta: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

auditLogSchema.index({ schoolId: 1, createdAt: -1 });
auditLogSchema.index({ schoolId: 1, actorId: 1, createdAt: -1 });
auditLogSchema.index({ schoolId: 1, targetUserId: 1, createdAt: -1 });
// Keep roughly six months of history so the collection can't grow forever.
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

export default model<IAuditLog>("AuditLog", auditLogSchema);
