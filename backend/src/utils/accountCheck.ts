import User from "../models/User";
import School from "../models/School";
import { AuthPayload } from "../middleware/auth";

export type AccountCheck = { ok: true; mustChangePassword: boolean } | { ok: false; message: string };

// A signed token proves who someone WAS at sign-in. This re-checks, on each
// request, that the account still exists and the school is still active, so
// deactivating a school or deleting a user takes effect within seconds instead
// of waiting for the token to expire (up to 8 hours).
// Results are cached briefly per instance so busy exam traffic (autosave every
// 15 seconds per student) doesn't add two database reads to every request.
const TTL_MS = 30_000;
const MAX_ENTRIES = 5000;
const cache = new Map<string, { result: AccountCheck; expires: number }>();

export function clearAccountCache() {
  cache.clear();
}

// Call after changing one user's password or flags so it applies on the next request.
export function forgetAccount(userId: string) {
  cache.delete(String(userId));
}

// Tokens carry "iat" in whole seconds; compare at the same precision.
export function tokenPredatesPasswordChange(iat: number | undefined, changedAt: Date | undefined): boolean {
  if (!changedAt || !iat) return false;
  return iat * 1000 < Math.floor(changedAt.getTime() / 1000) * 1000;
}

export async function checkAccount(p: AuthPayload): Promise<AccountCheck> {
  const now = Date.now();
  const hit = cache.get(p.userId);
  if (hit && hit.expires > now) return hit.result;

  const result = await lookup(p);
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(p.userId, { result, expires: now + TTL_MS });
  return result;
}

async function lookup(p: AuthPayload): Promise<AccountCheck> {
  const user = await User.findById(p.userId).select("role schoolId mustChangePassword passwordChangedAt").lean();
  if (!user) return { ok: false, message: "Your account no longer exists. Please contact your school." };
  if (user.role !== p.role || String(user.schoolId ?? "") !== String(p.schoolId ?? "")) {
    return { ok: false, message: "Your account has changed. Please sign in again." };
  }
  if (tokenPredatesPasswordChange(p.iat, user.passwordChangedAt)) {
    return { ok: false, message: "Your password was changed. Please sign in again." };
  }
  if (user.schoolId) {
    const school = await School.findById(user.schoolId).select("isActive").lean();
    if (!school || !school.isActive) {
      return { ok: false, message: "Your school's account is no longer active. Please contact your school." };
    }
  }
  return { ok: true, mustChangePassword: !!user.mustChangePassword };
}
