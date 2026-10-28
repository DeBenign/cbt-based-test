import AuthThrottle from "../models/AuthThrottle";

// Failed sign-in limits inside one rolling 15-minute window:
//  - pair: 5 wrong passwords for one account from one device/IP  -> that device is locked out of that account
//  - id:   20 wrong passwords for one account from anywhere      -> the account is paused (stops distributed guessing)
//  - ip:   100 failures from one IP across all accounts          -> generous, because a whole school shares one IP
// Successful sign-ins clear the pair and id counters.
export const WINDOW_MS = 15 * 60 * 1000;
export const LIMITS = { pair: 5, id: 20, ip: 100 };

export interface ThrottleStore {
  counts(keys: string[], now: number): Promise<Record<string, { count: number; expiresAt: number }>>;
  increment(key: string, now: number, windowMs: number): Promise<void>;
  clear(keys: string[]): Promise<void>;
}

function keysFor(loginId: string, ip: string) {
  const id = loginId.slice(0, 200);
  return { pair: `p:${id}|${ip}`, id: `i:${id}`, ip: `a:${ip}` };
}

export type ThrottleDecision = { allowed: true } | { allowed: false; retryAfterSec: number };

export async function checkLoginAllowed(store: ThrottleStore, loginId: string, ip: string, now = Date.now()): Promise<ThrottleDecision> {
  const k = keysFor(loginId, ip);
  const found = await store.counts([k.pair, k.id, k.ip], now);

  let retryMs = 0;
  for (const [name, key] of Object.entries(k) as ["pair" | "id" | "ip", string][]) {
    const row = found[key];
    if (row && row.count >= LIMITS[name]) retryMs = Math.max(retryMs, row.expiresAt - now);
  }
  return retryMs > 0 ? { allowed: false, retryAfterSec: Math.ceil(retryMs / 1000) } : { allowed: true };
}

export async function recordLoginFailure(store: ThrottleStore, loginId: string, ip: string, now = Date.now()) {
  const k = keysFor(loginId, ip);
  await Promise.all([k.pair, k.id, k.ip].map((key) => store.increment(key, now, WINDOW_MS)));
}

export async function recordLoginSuccess(store: ThrottleStore, loginId: string, ip: string) {
  const k = keysFor(loginId, ip);
  await store.clear([k.pair, k.id]);
}

export const mongoThrottleStore: ThrottleStore = {
  async counts(keys, now) {
    const rows = await AuthThrottle.find({ key: { $in: keys }, expiresAt: { $gt: new Date(now) } }).lean();
    return Object.fromEntries(rows.map((r) => [r.key, { count: r.count, expiresAt: r.expiresAt.getTime() }]));
  },
  async increment(key, now, windowMs) {
    // An expired row can linger for up to a minute before MongoDB's cleanup runs; drop it so the window restarts.
    await AuthThrottle.deleteOne({ key, expiresAt: { $lte: new Date(now) } });
    await AuthThrottle.updateOne(
      { key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now + windowMs) } },
      { upsert: true }
    );
  },
  async clear(keys) {
    await AuthThrottle.deleteMany({ key: { $in: keys } });
  }
};

// Generic "at most N requests per window per key" for endpoints like forgot-password.
// Every request counts (whether or not the account exists), so the limit itself
// can't be used to discover which accounts exist.
export async function takeSlots(
  store: ThrottleStore,
  rules: { key: string; limit: number }[],
  now = Date.now(),
  windowMs = WINDOW_MS
): Promise<ThrottleDecision> {
  const found = await store.counts(rules.map((r) => r.key), now);
  let retryMs = 0;
  for (const r of rules) {
    const row = found[r.key];
    if (row && row.count >= r.limit) retryMs = Math.max(retryMs, row.expiresAt - now);
  }
  if (retryMs > 0) return { allowed: false, retryAfterSec: Math.ceil(retryMs / 1000) };
  await Promise.all(rules.map((r) => store.increment(r.key, now, windowMs)));
  return { allowed: true };
}
