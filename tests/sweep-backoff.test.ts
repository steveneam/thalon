import { describe, expect, it } from "vitest";
import { backoffTickMs } from "../scripts/run-sweep-scheduler";

const MIN = 60_000;

/**
 * RATCHET (s75) — a failing sweep must not bill an external quota every tick.
 *
 * The incident this pins: on 2026-07-25 a sweep began failing for an unrelated
 * reason, and because a failed sweep deliberately leaves `last_sweep_at`
 * untouched (it stays DUE by design), the scheduler retried it every 15
 * minutes. Each retry spends ~100 YouTube quota units per watchlist query —
 * ~900 for the tenant's nine — so about eleven retries exhausted the whole
 * 10,000-unit daily allowance. The resulting 429 was itself a failure, so it
 * retried all day and the soak admitted nothing.
 *
 * The steady state was never the problem: at the tenant's 4-hour cadence a
 * healthy day spends ~5,400 of 10,000 units. Only the retry storm was. These
 * tests pin the shape of the fix so it cannot silently regress.
 */
describe("sweep scheduler failure backoff", () => {
  it("a clean pass ticks at the normal rate — no backoff when nothing failed", () => {
    expect(backoffTickMs(15 * MIN, 240 * MIN, 0)).toBe(15 * MIN);
  });

  it("consecutive failures grow the gap geometrically instead of retrying every tick", () => {
    expect(backoffTickMs(15 * MIN, 240 * MIN, 1)).toBe(30 * MIN);
    expect(backoffTickMs(15 * MIN, 240 * MIN, 2)).toBe(60 * MIN);
    expect(backoffTickMs(15 * MIN, 240 * MIN, 3)).toBe(120 * MIN);
  });

  it("never backs off slower than the schedule's own cadence asks for", () => {
    // Cadence 240m is the ceiling here: 15 × 2^5 = 480m would overshoot it.
    expect(backoffTickMs(15 * MIN, 240 * MIN, 5)).toBe(240 * MIN);
    expect(backoffTickMs(15 * MIN, 240 * MIN, 9)).toBe(240 * MIN);
  });

  it("a short cadence still backs off at least to the base tick, never below it", () => {
    // A 5-minute cadence must not make the backoff FASTER than a normal tick.
    expect(backoffTickMs(15 * MIN, 5 * MIN, 3)).toBe(15 * MIN);
  });

  it("is capped so a wedged scheduler still checks back within four hours", () => {
    expect(backoffTickMs(15 * MIN, 99_999 * MIN, 10)).toBe(4 * 60 * MIN);
  });

  it("the quota arithmetic the backoff exists to protect", () => {
    const UNITS_PER_SEARCH = 100; // youtube-source.ts states this in its own guard
    const QUERIES = 9; // the tenant's watchlist
    const FREE_DAILY_UNITS = 10_000; // YouTube Data API v3 free allowance
    const perSweep = UNITS_PER_SEARCH * QUERIES;

    // Healthy: a 4-hour cadence is 6 sweeps/day and fits comfortably.
    expect((24 * 60) / 240).toBe(6);
    expect(6 * perSweep).toBeLessThan(FREE_DAILY_UNITS);

    // The storm: retrying every 15 minutes exhausts the day in ~11 retries.
    expect(Math.ceil(FREE_DAILY_UNITS / perSweep)).toBe(12);
    expect((24 * 60) / 15).toBeGreaterThan(12); // …and a day has 96 such ticks
  });
});
