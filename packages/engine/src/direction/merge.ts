import { directionDocSchema, type DirectionDoc } from "@thalon/contracts";
import { directionLineFrom } from "./prefill";
import type { DirectionPolishShellOutput, DirectionScenesShellOutput } from "./schemas";

/**
 * Deterministic stage merges (B5.2): core takes a schema-valid shell fill
 * and rebuilds the direction document around the PINNED fields — aspect,
 * fps, pacing, scene count and order always come from the current doc,
 * never from the shell. Shell text is normalized to the single-line
 * contract on the way in; the rebuilt doc re-parses against the full
 * direction schema, so an un-mergeable fill is a semantically invalid
 * candidate (it consumes a repair attempt like any other).
 */

/** Returns the COMPLETE repair-loop error when the fill's sceneIndex set is not exactly the doc's (missing/duplicate/unknown — the B2.3 duplicate-window lesson), else null. */
export function sceneIndexSetError(
  doc: Pick<DirectionDoc, "scenes">,
  fill: { scenes: { sceneIndex: number }[] },
): string | null {
  const expected = doc.scenes.map((scene) => scene.sceneIndex);
  const got = fill.scenes.map((scene) => scene.sceneIndex);
  const gotSet = new Set(got);
  if (gotSet.size !== got.length) {
    return `duplicate sceneIndex in stage fill: [${got.join(", ")}]`;
  }
  const missing = expected.filter((i) => !gotSet.has(i));
  const unknown = got.filter((i) => !expected.includes(i));
  if (missing.length > 0 || unknown.length > 0) {
    return `stage fill must cover every scene exactly once — missing [${missing.join(", ")}], unknown [${unknown.join(", ")}]`;
  }
  return null;
}

/** Scenes/effects: creative slots land; everything else is carried from the prefilled doc verbatim. */
export function applyScenesStage(
  prefill: DirectionDoc,
  fill: DirectionScenesShellOutput,
): DirectionDoc {
  const byIndex = new Map(fill.scenes.map((scene) => [scene.sceneIndex, scene]));
  return directionDocSchema.parse({
    ...prefill,
    scenes: prefill.scenes.map((scene) => {
      const filled = byIndex.get(scene.sceneIndex);
      if (!filled) throw new Error(`stage fill missing sceneIndex ${scene.sceneIndex}`);
      return {
        ...scene,
        visual: directionLineFrom(filled.visual),
        motion: filled.motion,
        onScreenText:
          filled.onScreenText === null ? null : directionLineFrom(filled.onScreenText),
      };
    },
    ),
  });
}

/** Polish: the full creative surface lands; aspect/fps/pacing and the scene set stay pinned from the current doc. */
export function applyPolishStage(
  current: DirectionDoc,
  fill: DirectionPolishShellOutput,
): DirectionDoc {
  const byIndex = new Map(fill.scenes.map((scene) => [scene.sceneIndex, scene]));
  return directionDocSchema.parse({
    docVersion: current.docVersion,
    title: directionLineFrom(fill.title),
    aspect: current.aspect,
    fps: current.fps,
    pacing: current.pacing,
    scenes: current.scenes.map((scene) => {
      const filled = byIndex.get(scene.sceneIndex);
      if (!filled) throw new Error(`stage fill missing sceneIndex ${scene.sceneIndex}`);
      return {
        sceneIndex: scene.sceneIndex,
        heading: directionLineFrom(filled.heading),
        narration: directionLineFrom(filled.narration),
        onScreenText:
          filled.onScreenText === null ? null : directionLineFrom(filled.onScreenText),
        visual: directionLineFrom(filled.visual),
        motion: filled.motion,
        durationMs: filled.durationMs,
      };
    }),
    cta: fill.cta === null ? null : directionLineFrom(fill.cta),
  });
}
