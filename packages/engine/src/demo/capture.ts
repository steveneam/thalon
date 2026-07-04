import type { TenantCtx } from "@thalon/contracts";
import { sha256Hex, stableStringify, type Draft, type Repos } from "@thalon/db";
import { getObjectStore, type ObjectStore } from "@thalon/platform";
import type { DemoCaptureArtifacts, DemoDriver, DemoStepOutcome } from "./driver";
import { demoPlanDraftMetaSchema, type DemoPlanDraftMeta } from "./schemas";

export interface DemoCaptureCursorPoint {
  stepIndex: number;
  timestamp: number;
  cursor: { x: number; y: number } | null;
}

export interface DemoCaptureBundle {
  /** Per-action log: action, target, timestamp, outcome (CHARTER B2.5). */
  eventTrace: DemoStepOutcome[];
  /** Per-step cursor positions/timestamps — data for a future render stage, never burned into the video. */
  cursorTrack: DemoCaptureCursorPoint[];
  /** Base64-encoded video bytes, or null when the driver recorded none (e.g. a fake driver in tests). */
  video: string | null;
}

export interface DriveDemoCaptureDeps {
  objectStore?: ObjectStore;
  /** Reads the driver's recorded video file (tests never exercise this — the fake driver returns `videoPath: null`). Overridable so ./capture.ts stays filesystem-free in tests. */
  readVideo?: (videoPath: string) => Promise<Buffer>;
}

export type DriveDemoCaptureResult =
  | { status: "captured"; draft: Draft; captureRef: string }
  | { status: "failed"; draft: Draft; error: string; failedStepIndex: number };

async function defaultReadVideo(videoPath: string): Promise<Buffer> {
  const { readFile } = await import("node:fs/promises");
  return readFile(videoPath);
}

/**
 * B2.5 stage 4 entry point (CHARTER B2.5): drives an approved `demo_plan`
 * draft's steps through a `DemoDriver`, one step at a time, in `stepIndex`
 * order. Runs ONLY against an `approved` draft — asserted up front, fails
 * loudly otherwise (this is post-approval-only work, never speculative
 * render spend). Any step failure stops the drive immediately:
 * `captureStatus` becomes "failed", the failing step's error is surfaced,
 * and NO `captureRef` is ever written — fails loudly at capture, before any
 * render spend. Only a clean run of every step writes the content-addressed
 * capture bundle (video + synthetic cursor track + event trace) to the
 * object store (the existing local->s3 seam) and back onto the draft's meta
 * via `repos.drafts.updateMeta` (optimistic-concurrency-guarded on the
 * `updatedAt` this function read at the very start — a concurrent drive of
 * the same draft loses as a loud `ConcurrentUpdateError`, never a silent
 * clobber of the other drive's result).
 */
export async function driveDemoCapture(
  ctx: TenantCtx,
  repos: Repos,
  draftId: string,
  driver: DemoDriver,
  deps: DriveDemoCaptureDeps = {},
): Promise<DriveDemoCaptureResult> {
  const draft = await repos.drafts.get(ctx, draftId);
  if (draft.status !== "approved") {
    throw new Error(
      `draft "${draftId}" is status "${draft.status}" — demo capture drives ONLY an "approved" draft`,
    );
  }
  const meta = demoPlanDraftMetaSchema.parse(draft.meta);
  const expectedUpdatedAt = draft.updatedAt;
  const objectStore = deps.objectStore ?? getObjectStore();
  const readVideo = deps.readVideo ?? defaultReadVideo;

  const eventTrace: DemoStepOutcome[] = [];
  const cursorTrack: DemoCaptureCursorPoint[] = [];

  await driver.start();
  const steps = [...meta.steps].sort((a, b) => a.stepIndex - b.stepIndex);
  for (const step of steps) {
    const outcome = await driver.runStep({
      action: step.action,
      target: step.target,
      value: step.value,
    });
    eventTrace.push(outcome);
    cursorTrack.push({ stepIndex: step.stepIndex, timestamp: outcome.timestamp, cursor: outcome.cursor });
    if (outcome.outcome === "error") {
      // `finish()` carries no no-throw contract (unlike `runStep`), and a
      // teardown failure here is CORRELATED with the step failure that
      // triggered this branch — e.g. the real Playwright driver's
      // page/context/browser `.close()` calls can throw. The "failed" meta
      // write must land regardless, or a prior successful capture's
      // captureStatus/captureRef would durably survive as a lie about this
      // drive. Surface (never swallow) a teardown error by folding it into
      // the reported error message.
      let teardownError: string | undefined;
      try {
        await driver.finish();
      } catch (err) {
        teardownError = err instanceof Error ? err.message : String(err);
      }
      const failedMeta: DemoPlanDraftMeta = { ...meta, captureStatus: "failed", captureRef: null };
      const updated = await repos.drafts.updateMeta(ctx, draftId, expectedUpdatedAt, failedMeta);
      const stepError = outcome.error ?? `step ${step.stepIndex} (${step.action} "${step.target}") failed`;
      return {
        status: "failed",
        draft: updated,
        error: teardownError
          ? `${stepError}; additionally, driver teardown failed: ${teardownError}`
          : stepError,
        failedStepIndex: step.stepIndex,
      };
    }
  }

  // Symmetric check: on the success path, nothing is written to `meta`
  // until AFTER `finish()` resolves and the bundle is built and stored — so
  // a `finish()` throw here cannot durably lie about this drive's outcome
  // (the draft's prior true state, whatever it was, simply stands). Still
  // wrapped for a clear, attributable error message rather than a bare
  // driver exception.
  let artifacts: DemoCaptureArtifacts;
  try {
    artifacts = await driver.finish();
  } catch (err) {
    throw new Error(
      `demo capture driver teardown failed after all ${steps.length} step(s) succeeded (no capture bundle was persisted): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  const bundle: DemoCaptureBundle = {
    eventTrace,
    cursorTrack,
    video: artifacts.videoPath ? (await readVideo(artifacts.videoPath)).toString("base64") : null,
  };
  const bundleJson = stableStringify(bundle);
  const captureRef = `demo-captures/${sha256Hex(bundleJson)}.json`;
  await objectStore.put(captureRef, bundleJson);

  const capturedMeta: DemoPlanDraftMeta = { ...meta, captureStatus: "captured", captureRef };
  const updated = await repos.drafts.updateMeta(ctx, draftId, expectedUpdatedAt, capturedMeta);
  return { status: "captured", draft: updated, captureRef };
}
