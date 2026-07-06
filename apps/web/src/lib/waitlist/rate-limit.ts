/**
 * Per-IP fixed-window rate limit for the waitlist join (docs/FRONTEND.md §2).
 * In-memory and therefore PER-INSTANCE — honest scope: it stops casual abuse
 * of the one public write path; platform-level limits (WAF) are the B6.7
 * deploy-time upgrade. No dependency, no shared state to provision.
 */

export const WINDOW_MS = 60_000;
export const MAX_JOINS_PER_WINDOW = 5;

/** Sweep threshold — prevents unbounded growth under IP churn. */
const SWEEP_AT = 10_000;

type Window = { count: number; startedAt: number };

const windows = new Map<string, Window>();

export interface RateLimitVerdict {
  allowed: boolean;
  /** Seconds until the window resets — the Retry-After header value. */
  retryAfterSec: number;
}

export function checkRateLimit(ip: string, now: number = Date.now()): RateLimitVerdict {
  if (windows.size >= SWEEP_AT) {
    for (const [key, w] of windows) {
      if (now - w.startedAt >= WINDOW_MS) windows.delete(key);
    }
  }
  const current = windows.get(ip);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    windows.set(ip, { count: 1, startedAt: now });
    return { allowed: true, retryAfterSec: 0 };
  }
  current.count += 1;
  if (current.count > MAX_JOINS_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((current.startedAt + WINDOW_MS - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** Test seam — module-level state resets like resetStagedFlowStore. */
export function resetRateLimit(): void {
  windows.clear();
}
