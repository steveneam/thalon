/**
 * Rate limiting (B2.5 stage 1 safety invariant, CHARTER B2.5): the minimum
 * delay between crawl requests lives in core, not the shell.
 * `msUntilNextRequest` is the pure calculation tests exercise directly;
 * `createRateLimiter` is the thin stateful wrapper whose only impure part is
 * the actual wait — tests inject a fake clock/sleep so timing assertions
 * never really wait.
 */
export function msUntilNextRequest(
  lastRequestAt: number | null,
  now: number,
  minDelayMs: number,
): number {
  if (lastRequestAt === null) return 0;
  const elapsed = now - lastRequestAt;
  if (elapsed < 0) return minDelayMs; // clock went backwards — be conservative, wait the full window
  return Math.max(0, minDelayMs - elapsed);
}

export interface RateLimiterDeps {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface RateLimiter {
  /** Waits (if needed) so this call starts at least `minDelayMs` after the previous one, then records itself as the new "previous" request. */
  beforeRequest(): Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function createRateLimiter(minDelayMs: number, deps: RateLimiterDeps = {}): RateLimiter {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;
  let lastRequestAt: number | null = null;
  return {
    async beforeRequest(): Promise<void> {
      const waitMs = msUntilNextRequest(lastRequestAt, now(), minDelayMs);
      if (waitMs > 0) await sleep(waitMs);
      lastRequestAt = now();
    },
  };
}
