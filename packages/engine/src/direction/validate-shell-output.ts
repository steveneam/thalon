import type { DirectionDoc } from "@thalon/contracts";
import { generateValidatedCandidate, type ValidatedCallResult } from "../pipeline/repair-loop";
import { applyPolishStage, applyScenesStage, sceneIndexSetError } from "./merge";
import {
  directionPolishShellOutputSchema,
  directionScenesShellOutputSchema,
  storyboardStageShellOutputSchema,
  type DirectionPolishShellOutput,
  type DirectionScenesShellOutput,
  type StoryboardStageShellOutput,
} from "./schemas";
import type {
  DirectionPolishDriver,
  DirectionPolishRequest,
  DirectionScenesDriver,
  DirectionScenesRequest,
  StoryboardStageDriver,
  StoryboardStageRequest,
} from "./shell/generator";

/**
 * The shell→core boundary guards for the three shipped video stages: the
 * shared bounded repair loop (B4.1) plus each stage's semantic checks — a
 * fill that misses/duplicates scenes or produces an un-mergeable document
 * is a malformed candidate and consumes a repair attempt (the B2.3
 * duplicate-window lesson, applied before anything can half-persist).
 */

export async function generateValidatedStoryboardStage(
  driver: StoryboardStageDriver,
  req: StoryboardStageRequest,
  opts: { maxAttempts?: number } = {},
): Promise<ValidatedCallResult<StoryboardStageShellOutput>> {
  return generateValidatedCandidate(driver, req, storyboardStageShellOutputSchema, {
    maxAttempts: opts.maxAttempts,
  });
}

/** A merge that throws marks the candidate semantically invalid — the repair loop retries with a fresh generation. */
function mergeError(run: () => unknown): string | null {
  try {
    run();
    return null;
  } catch (err) {
    return `stage fill does not merge into a valid direction doc: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function generateValidatedScenesStage(
  driver: DirectionScenesDriver,
  req: DirectionScenesRequest,
  prefill: DirectionDoc,
  opts: { maxAttempts?: number } = {},
): Promise<ValidatedCallResult<DirectionScenesShellOutput>> {
  return generateValidatedCandidate(driver, req, directionScenesShellOutputSchema, {
    maxAttempts: opts.maxAttempts,
    validate: (output) =>
      sceneIndexSetError(prefill, output) ?? mergeError(() => applyScenesStage(prefill, output)),
  });
}

export async function generateValidatedPolishStage(
  driver: DirectionPolishDriver,
  req: DirectionPolishRequest,
  current: DirectionDoc,
  opts: { maxAttempts?: number } = {},
): Promise<ValidatedCallResult<DirectionPolishShellOutput>> {
  return generateValidatedCandidate(driver, req, directionPolishShellOutputSchema, {
    maxAttempts: opts.maxAttempts,
    validate: (output) =>
      sceneIndexSetError(current, output) ?? mergeError(() => applyPolishStage(current, output)),
  });
}
