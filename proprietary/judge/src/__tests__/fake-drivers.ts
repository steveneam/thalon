import type { JudgeModelDriver } from "../shell/driver";

/** Deterministic token spend every fake gateway call reports (asserted in usage-metering tests). */
export const FAKE_TOKENS_IN = 7;
export const FAKE_TOKENS_OUT = 3;

/** A driver that always returns the same canned candidate — scripts a pass/fail tier in tests. */
export function fixedDriver(output: unknown): JudgeModelDriver {
  return async () => ({ candidate: output, tokensIn: FAKE_TOKENS_IN, tokensOut: FAKE_TOKENS_OUT });
}

/** A driver that returns `script[n]` on its n-th call (the last entry repeats); an Error entry throws. */
export function scriptedDriver(script: unknown[]): JudgeModelDriver {
  let i = 0;
  return async () => {
    const next = script[Math.min(i, script.length - 1)];
    i++;
    if (next instanceof Error) throw next;
    return { candidate: next, tokensIn: FAKE_TOKENS_IN, tokensOut: FAKE_TOKENS_OUT };
  };
}

export interface CountingDriver {
  driver: JudgeModelDriver;
  count: number;
}

/** Wraps a driver to count invocations — proves "zero model calls" / "bounded retries" claims. */
export function withCallCount(inner: JudgeModelDriver): CountingDriver {
  const counting: CountingDriver = {
    count: 0,
    driver: async (req) => {
      counting.count++;
      return inner(req);
    },
  };
  return counting;
}
