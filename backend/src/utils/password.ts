import jwt from "jsonwebtoken";

// Existing rule, now in one place. Consider raising it (at least for admin accounts).
export const MIN_PASSWORD_LENGTH = 4;

export function signToken(user: { _id: unknown; schoolId?: unknown; role: string }): string {
  return jwt.sign(
    { userId: user._id, schoolId: user.schoolId, role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" } as jwt.SignOptions
  );
}
