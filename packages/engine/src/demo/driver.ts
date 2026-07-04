import type { DemoPlanStep } from "./schemas";

export interface CursorPoint {
  x: number;
  y: number;
}

export interface DemoStepOutcome {
  action: DemoPlanStep["action"];
  target: string;
  /** Milliseconds since the session started (../capture.ts's event trace + cursor track timestamps). */
  timestamp: number;
  outcome: "ok" | "error";
  error?: string;
  /** The step's computed cursor position (element-center for a selector-based action; null for `goto` or when unavailable) — data for a future render stage, never burned into the video (CHARTER B2.5). */
  cursor: CursorPoint | null;
}

export interface DemoCaptureArtifacts {
  /** Absolute path to the recorded video file, or null when the driver records no video (e.g. the fake driver). */
  videoPath: string | null;
}

/**
 * B2.5 stage 4 seam (SPINE §1: shell/driver code stays read-only and never
 * persists — only ./capture.ts, the core caller, writes anything). A demo
 * driver runs ONE storyboard step at a time and never throws for a
 * step-level failure (navigation/selector/assertion) — it reports the
 * failure via the returned outcome so the capture orchestrator can fail
 * loudly with the full per-step trace, never a bare exception. Mirrors the
 * real-vs-fake split every other seam in this engine uses (waterfall's
 * `HighlightSelectDriver`, judge's `JudgeModelDriver`): ./playwright-driver.ts
 * is the real, browser-backed implementation; ./fake-driver.ts is the
 * deterministic test double.
 */
export interface DemoDriver {
  /** Starts a fresh session (browser context / fake equivalent) and begins recording. */
  start(): Promise<void>;
  /** Executes ONE storyboard step. Never throws for a step-level failure — reports it via `outcome`. */
  runStep(step: Pick<DemoPlanStep, "action" | "target" | "value">): Promise<DemoStepOutcome>;
  /** Ends the session and returns the recorded artifacts. */
  finish(): Promise<DemoCaptureArtifacts>;
}
