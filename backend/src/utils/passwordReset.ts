import crypto from "crypto";

export const RESET_TTL_MS = 30 * 60 * 1000;

// Bulk-created accounts without an email get a placeholder address that can't receive mail.
export const SYNTHETIC_EMAIL_DOMAIN = "@users.benchmark.local";

export function isSyntheticEmail(email: string): boolean {
  return email.toLowerCase().endsWith(SYNTHETIC_EMAIL_DOMAIN);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateResetToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: hashToken(token) };
}

export function resetLink(token: string, frontendUrl = process.env.FRONTEND_URL || ""): string {
  return `${frontendUrl.replace(/\/+$/, "")}/reset-password?token=${token}`;
}
