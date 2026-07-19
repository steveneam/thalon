import { describe, expect, it } from "vitest";
import { applyScheduleToStamp } from "../schedule-stamp";
import type { SweepStamp } from "../types";

const NOW = Date.parse("2026-07-19T12:00:00.000Z");
const MINUTE = 60_000;

const base: SweepStamp = {
  lastSweptAt: "2026-07-19T08:00:00.000Z",
  intervalHours: 4,
  // The bundle's advisory arithmetic — exactly what the schedule truth replaces.
  nextSweepAt: "2026-07-19T12:00:00.000Z",
};

describe("applyScheduleToStamp", () => {
  it("disabled or absent keeps the honest null — there IS no next sweep", () => {
    expect(applyScheduleToStamp(base, null, NOW).nextSweepAt).toBeNull();
    const disabled = applyScheduleToStamp(
      base,
      { enabled: false, cadenceMinutes: 60, lastSweepAt: new Date(NOW - 300 * MINUTE) },
      NOW,
    );
    expect(disabled.nextSweepAt).toBeNull();
    expect(disabled.dueNow).toBeUndefined();
  });

  it("enabled + not yet due shows the real next-sweep time (lastSweepAt + cadence)", () => {
    const stamp = applyScheduleToStamp(
      base,
      { enabled: true, cadenceMinutes: 240, lastSweepAt: new Date(NOW - 30 * MINUTE) },
      NOW,
    );
    expect(stamp.nextSweepAt).toBe(new Date(NOW + 210 * MINUTE).toISOString());
    expect(stamp.dueNow).toBe(false);
    expect(stamp.intervalHours).toBe(4);
  });

  it("enabled + past due is due now, the elapsed time shown honestly", () => {
    const stamp = applyScheduleToStamp(
      base,
      { enabled: true, cadenceMinutes: 60, lastSweepAt: new Date(NOW - 90 * MINUTE) },
      NOW,
    );
    expect(stamp.dueNow).toBe(true);
    expect(stamp.nextSweepAt).toBe(new Date(NOW - 30 * MINUTE).toISOString());
  });

  it("enabled + never swept is due now with NO fabricated timestamp", () => {
    const stamp = applyScheduleToStamp(
      base,
      { enabled: true, cadenceMinutes: 60, lastSweepAt: null },
      NOW,
    );
    expect(stamp.dueNow).toBe(true);
    expect(stamp.nextSweepAt).toBeNull();
  });

  it("exactly-due is due (boundary matches the scheduler's findDueTenants)", () => {
    const stamp = applyScheduleToStamp(
      base,
      { enabled: true, cadenceMinutes: 60, lastSweepAt: new Date(NOW - 60 * MINUTE) },
      NOW,
    );
    expect(stamp.dueNow).toBe(true);
  });
});
