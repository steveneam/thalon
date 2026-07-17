import { outreachSequenceSchema } from "@thalon/contracts";
import { describe, expect, it } from "vitest";
import { deriveCadence, isSendDay, utcDayKey } from "../cadence";

const DAY = 24 * 60 * 60 * 1000;
/** 2026-07-15T12:00Z is a Wednesday. */
const WED_NOON = Date.UTC(2026, 6, 15, 12);

const seq = (input: Record<string, unknown> = {}) => outreachSequenceSchema.parse(input);
const send = (ms: number) => ({ sentAt: new Date(ms) });

describe("deriveCadence (pure — the ledger + config ARE the cadence state)", () => {
  it("no history: touch 0 is due immediately (the sequence anchors on the first send)", () => {
    expect(deriveCadence([], seq(), WED_NOON)).toEqual({
      nextTouchIndex: 0,
      dueAtMs: WED_NOON,
      complete: false,
    });
  });

  it("after touch 0: touch 1 is due exactly D3 from the first send (default D0/3/10/17)", () => {
    const state = deriveCadence([send(WED_NOON)], seq(), WED_NOON + DAY);
    expect(state).toEqual({
      nextTouchIndex: 1,
      dueAtMs: WED_NOON + 3 * DAY,
      complete: false,
    });
  });

  it("offsets anchor on SEQUENCE START — a late touch 1 never stretches the tail", () => {
    // Touch 1 went out three days late (D6 instead of D3); touch 2 stays due at D10.
    const state = deriveCadence([send(WED_NOON), send(WED_NOON + 6 * DAY)], seq(), WED_NOON + 7 * DAY);
    expect(state.nextTouchIndex).toBe(2);
    expect(state.dueAtMs).toBe(WED_NOON + 10 * DAY);
  });

  it("all configured touches sent: complete, nothing is ever due again", () => {
    const sends = [0, 3, 10, 17].map((d) => send(WED_NOON + d * DAY));
    expect(deriveCadence(sends, seq(), WED_NOON + 30 * DAY)).toEqual({
      nextTouchIndex: 4,
      dueAtMs: null,
      complete: true,
    });
  });

  it("history order is not trusted — the earliest send anchors regardless of input order", () => {
    const shuffled = [send(WED_NOON + 3 * DAY), send(WED_NOON)];
    expect(deriveCadence(shuffled, seq(), WED_NOON + 4 * DAY).dueAtMs).toBe(WED_NOON + 10 * DAY);
  });

  it("a non-zero first offset fixes the anchor so the first send sits on its own offset", () => {
    // Offsets D2/D5: one send at T means sequence start = T - 2d, touch 1 due T + 3d.
    const state = deriveCadence([send(WED_NOON)], seq({ touchOffsetsDays: [2, 5] }), WED_NOON);
    expect(state.dueAtMs).toBe(WED_NOON + 3 * DAY);
  });
});

describe("isSendDay / utcDayKey (weight 0 = never; weekends off by default)", () => {
  it("weekdays send, weekends are OFF with the default weights", () => {
    const weights = seq().sendDayWeights;
    expect(isSendDay(WED_NOON, weights)).toBe(true); // wed (1.5 — survey-weighted)
    expect(isSendDay(WED_NOON + 5 * DAY, weights)).toBe(true); // mon
    expect(isSendDay(WED_NOON + 3 * DAY, weights)).toBe(false); // sat
    expect(isSendDay(WED_NOON + 4 * DAY, weights)).toBe(false); // sun
  });

  it("weight 0 turns ANY day off — an operator can silence Wednesday too", () => {
    const weights = seq({ sendDayWeights: { wed: 0 } }).sendDayWeights;
    expect(isSendDay(WED_NOON, weights)).toBe(false);
    expect(isSendDay(WED_NOON + 1 * DAY, weights)).toBe(true); // thu keeps its default
  });

  it("utcDayKey maps a timestamp to its UTC weekday key", () => {
    expect(utcDayKey(WED_NOON)).toBe("wed");
    expect(utcDayKey(WED_NOON + 3 * DAY)).toBe("sat");
    expect(utcDayKey(WED_NOON + 5 * DAY)).toBe("mon");
  });
});
