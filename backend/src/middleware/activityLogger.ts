import { Request, Response, NextFunction } from "express";
import AuditLog from "../models/AuditLog";
import { AuthedRequest } from "./auth";

// [method, path pattern (after /api/v1/<role>), human label]
const LABELS: [string, RegExp, string][] = [
  ["POST", /^\/questions\/generate$/, "Generated AI draft questions"],
  ["POST", /^\/questions\/drafts\/approve$/, "Approved AI draft questions"],
  ["POST", /^\/questions$/, "Added a question"],
  ["PUT", /^\/questions\/[a-f0-9]{24}$/, "Edited a question"],
  ["DELETE", /^\/questions\/[a-f0-9]{24}$/, "Deleted a question"],
  ["POST", /^\/exams$/, "Created an exam"],
  ["PUT", /^\/exams\/[a-f0-9]{24}$/, "Edited an exam"],
  ["DELETE", /^\/exams\/[a-f0-9]{24}$/, "Deleted an exam"],
  ["POST", /^\/exams\/[a-f0-9]{24}\/publish$/, "Published an exam"],
  ["POST", /^\/exams\/[a-f0-9]{24}\/auto-fill$/, "Auto-filled exam questions"],
  ["POST", /^\/exams\/[a-f0-9]{24}\/questions$/, "Attached questions to an exam"],
  ["DELETE", /^\/exams\/[a-f0-9]{24}\/questions\/[a-f0-9]{24}$/, "Removed a question from an exam"],
  ["POST", /^\/attempts\/[a-f0-9]{24}\/start$/, "Started or resumed an exam"],
  ["POST", /^\/attempts\/[a-f0-9]{24}\/submit$/, "Submitted an exam"],
  ["POST", /^\/attempts\/[a-f0-9]{24}\/flag$/, "Integrity event reported during an exam"],
  ["POST", /^\/grading\/attempts\/[a-f0-9]{24}\/questions\/[a-f0-9]{24}$/, "Graded a theory answer"],
  ["POST", /^\/curriculum$/, "Uploaded a curriculum"],
  ["DELETE", /^\/curriculum\/[a-f0-9]{24}$/, "Deleted a curriculum"],
  ["POST", /^\/users\/[a-f0-9]{24}\/reset-password$/, "Reset a user's password"],
  ["DELETE", /^\/users\/[a-f0-9]{24}$/, "Deleted a user account"],
  ["POST", /^\/classes$/, "Added a class"],
  ["POST", /^\/subjects$/, "Added a subject"],
  ["PUT", /^\/branding$/, "Updated branding"]
];

// High-frequency or non-school traffic that would only add noise.
const SKIP = [/\/autosave$/, /^\/webhooks\//, /^\/superadmin\//, /^\/auth\/login$/];

function describe(method: string, path: string): { action: string; label: string } {
  const withoutRole = path.replace(/^\/(admin|teacher|student)/, "");
  for (const [m, re, label] of LABELS) {
    if (m === method && re.test(withoutRole)) {
      return { action: `${method.toLowerCase()}:${withoutRole.replace(/[a-f0-9]{24}/g, ":id")}`, label };
    }
  }
  return { action: `${method.toLowerCase()}:${withoutRole.replace(/[a-f0-9]{24}/g, ":id")}`, label: `${method} ${withoutRole}` };
}

// Records every successful state-changing request made by a signed-in school
// user. The write happens BEFORE the response is flushed (res.end is held for
// the few milliseconds it takes) because serverless functions can be frozen as
// soon as the response goes out, which would silently drop the log entry.
export function activityLogger(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const originalEnd = res.end.bind(res) as (...args: any[]) => Response;
  (res as any).end = function (...args: any[]) {
    const user = (req as AuthedRequest).user;
    const path = req.originalUrl.split("?")[0].replace(/^\/api\/v1/, "");
    const shouldLog =
      !!user?.schoolId &&
      res.statusCode < 400 &&
      !res.locals.auditLogged &&
      !SKIP.some((re) => re.test(path)) &&
      !path.startsWith("/admin/review"); // admin corrections log themselves with reasons

    if (!shouldLog) return originalEnd(...args);

    const { action, label } = describe(req.method, path);
    const ids = path.match(/[a-f0-9]{24}/g);
    AuditLog.create({
      schoolId: user!.schoolId,
      actorId: user!.userId,
      actorRole: user!.role,
      action,
      summary: label,
      entityType: path.split("/")[2],
      entityId: ids ? ids[ids.length - 1] : undefined,
      meta: { method: req.method, path, status: res.statusCode }
    })
      .catch((err) => console.error("audit log write failed", err))
      .finally(() => originalEnd(...args));
    return res;
  };
  next();
}
