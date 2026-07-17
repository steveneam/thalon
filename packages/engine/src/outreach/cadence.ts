import type { OutreachSequence, SendDayWeights } from "@thalon/contracts";

/**
 * B-crm.4 back half (s54): cadence math — pure functions, no I/O, no clock
 * reads. Cadence state is DERIVED from the send ledger + the tenant's
 * `outreach` sequence config every time it is needed (the frozen-contract
 * decision: there is deliberately no mutable cadence-state table to drift
 * from the ledger).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CadenceState {
  /** Which touch goes next — always the lead's send-history length. */
  nextTouchIndex: number;
  /**
   * When that touch is due (ms epoch); `null` when the sequence is
   * complete. Touch 0 is due immediately — the sequence has no anchor
   * until the operator sends it.
   */
  dueAtMs: number | null;
  /** Every configured touch has gone out — nothing further is ever due. */
  complete: boolean;
}

/**
 * Derives the next touch from a lead's send history. `touchOffsetsDays` are
 * day offsets from SEQUENCE START (contracts): the anchor is fixed so the
 * first recorded send sits exactly on its own offset (with the default
 * D0-first config the anchor IS the first send), and every later touch is
 * due at anchor + its offset — a late touch never stretches the tail of
 * the sequence. History order is not trusted: sends are re-sorted by
 * sentAt before the earliest anchors the sequence.
 */
export function deriveCadence(
  sends: ReadonlyArray<{ sentAt: Date }>,
  sequence: OutreachSequence,
  nowMs: number,
): CadenceState {
  const offsets = sequence.touchOffsetsDays;
  const nextTouchIndex = sends.length;
  if (nextTouchIndex >= offsets.length) {
    return { nextTouchIndex, dueAtMs: null, complete: true };
  }
  if (nextTouchIndex === 0) {
    return { nextTouchIndex: 0, dueAtMs: nowMs, complete: false };
  }
  const ordered = [...sends].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  const anchorMs = ordered[0].sentAt.getTime() - offsets[0] * DAY_MS;
  return { nextTouchIndex, dueAtMs: anchorMs + offsets[nextTouchIndex] * DAY_MS, complete: false };
}

/** UTC weekday keys in getUTCDay() order — the sendDayWeightsSchema vocabulary. */
const UTC_DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** The UTC weekday a timestamp falls on, as a sendDayWeights key. */
export function utcDayKey(nowMs: number): keyof SendDayWeights {
  return UTC_DAY_KEYS[new Date(nowMs).getUTCDay()];
}

/**
 * Weight 0 = NEVER send on this day (weekends off by default); any positive
 * weight is a scheduling preference, not a gate — so this is the only
 * question the send door asks of the weights.
 */
export function isSendDay(nowMs: number, weights: SendDayWeights): boolean {
  return weights[utcDayKey(nowMs)] > 0;
}
