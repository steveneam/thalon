/**
 * B6.1 "skip the line" math (docs/FRONTEND.md §2). The stored `position` is
 * the immutable join order (schema/web.ts: assigned once, never rewritten);
 * the position we SHOW is derived here at read time — one place, tested,
 * shared by the API route and anything wave-2 renders.
 */

/** How many spots one referral moves a signup up. Opinion, not invariant. */
export const SPOTS_PER_REFERRAL = 5;

/** Floor at 1 — referrals can put you first, never "position 0". */
export function effectivePosition(position: number, referrals: number): number {
  if (!Number.isInteger(position) || position < 1) {
    throw new Error(`waitlist position must be a positive integer, got ${position}`);
  }
  if (!Number.isInteger(referrals) || referrals < 0) {
    throw new Error(`referral count must be a non-negative integer, got ${referrals}`);
  }
  return Math.max(1, position - referrals * SPOTS_PER_REFERRAL);
}
