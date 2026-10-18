import { Request } from "express";
import AuditLog from "../models/AuditLog";
import { AuthedRequest } from "../middleware/auth";

export interface ActivityInput {
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  targetUserId?: string;
  meta?: Record<string, unknown>;
}

// Never throws: an audit-log hiccup must not break the action being logged.
// Callers should `await` it -- on serverless the function can be frozen the
// moment the response is sent, so un-awaited writes can be lost.
export async function logActivity(req: Request, input: ActivityInput): Promise<void> {
  const user = (req as AuthedRequest).user;
  if (!user?.schoolId) return;
  try {
    if (req.res) req.res.locals.auditLogged = true; // tells the generic logger this one is already covered
    await AuditLog.create({
      schoolId: user.schoolId,
      actorId: user.userId,
      actorRole: user.role,
      ...input
    });
  } catch (err) {
    console.error("audit log write failed", err);
  }
}
