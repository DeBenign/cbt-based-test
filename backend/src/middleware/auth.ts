import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { checkAccount } from "../utils/accountCheck";

export interface AuthPayload {
  userId: string;
  schoolId: string;
  role: "superadmin" | "admin" | "teacher" | "student";
  iat?: number;
}

export interface AuthedRequest extends Request {
  user?: AuthPayload;
}

function buildRequireAuth(allowWhileMustChangePassword: boolean) {
  return async function (req: AuthedRequest, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or malformed Authorization header" });
    }
    const token = header.split(" ")[1];

    let payload: AuthPayload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET as string) as AuthPayload;
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    try {
      const account = await checkAccount(payload);
      if (!account.ok) {
        // The "code" tells the frontend to sign the person out and show the reason.
        return res.status(401).json({ error: account.message, code: "SESSION_INVALID" });
      }
      // Temporary password: the server (not just the app) refuses everything
      // except the change-password call until a new one is chosen.
      if (account.mustChangePassword && !allowWhileMustChangePassword) {
        return res.status(403).json({
          error: "You must choose a new password before you can continue.",
          code: "PASSWORD_CHANGE_REQUIRED"
        });
      }
    } catch (err) {
      return next(err);
    }

    req.user = payload;
    next();
  };
}

export const requireAuth = buildRequireAuth(false);
// Only for the change-password endpoint.
export const requireAuthAllowPasswordChange = buildRequireAuth(true);
