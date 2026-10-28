import crypto from "crypto";

// Vercel Cron (and any external scheduler) calls with "Authorization: Bearer <CRON_SECRET>".
// Constant-time comparison; refuses everything when no secret is configured.
export function isValidCronAuth(header: string | undefined, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
