import type { CursorPoint, DemoCaptureArtifacts, DemoDriver, DemoStepOutcome } from "./driver";

export interface FakeDemoDriverDeps {
  /** Targets (selector or goto URL) this fake reports as failing — every other step always succeeds. Lets tests exercise the "fail loudly at capture" path deterministically. */
  failTargets?: readonly string[];
  now?: () => number;
}

/**
 * Deterministic test double for the B2.5 stage-4 driver: no browser, no
 * network, no filesystem — keeps every capture test keyless and
 * browser-free. Every step reports `outcome: "ok"` unless its target is
 * listed in `failTargets`, in which case it reports `outcome: "error"`
 * WITHOUT throwing — exactly matching the real driver's contract. Cursor
 * positions are a stable synthetic sequence (not a real DOM measurement) —
 * this is a fake, not a browser.
 */
export function createFakeDemoDriver(deps: FakeDemoDriverDeps = {}): DemoDriver {
  const now = deps.now ?? Date.now;
  const failTargets = new Set(deps.failTargets ?? []);
  let sessionStart = 0;
  let stepCount = 0;

  return {
    async start(): Promise<void> {
      sessionStart = now();
      stepCount = 0;
    },

    async runStep(step): Promise<DemoStepOutcome> {
      const timestamp = now() - sessionStart;
      const cursor: CursorPoint = { x: 100 + stepCount * 10, y: 100 + stepCount * 10 };
      stepCount += 1;
      if (failTargets.has(step.target)) {
        return {
          action: step.action,
          target: step.target,
          timestamp,
          outcome: "error",
          error: `fake driver: step targeting "${step.target}" is configured to fail`,
          cursor,
        };
      }
      return { action: step.action, target: step.target, timestamp, outcome: "ok", cursor };
    },

    async finish(): Promise<DemoCaptureArtifacts> {
      return { videoPath: null };
    },
  };
}
