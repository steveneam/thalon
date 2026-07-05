import {
  DIRECTION_ASPECTS,
  DIRECTION_DOC_VERSION,
  DIRECTION_MOTIONS,
  DIRECTION_PACINGS,
  directionDocSchema,
  type DirectionAspect,
  type DirectionDoc,
  type DirectionMotion,
  type DirectionPacing,
  type PlatformProfile,
  type StoryboardDraftMeta,
} from "@thalon/contracts";
import { derivedCueDurationMs } from "../render/srt";

/**
 * Deterministic-first prefill (B5.2, amendment A11 — SPINE §1 doctrine
 * applied to video creation): everything computable about a direction
 * document is COMPUTED here, before any model sees it. Aspect/fps/pacing/
 * motion come from the tenant's platform config (data, never code) or the
 * shipped defaults; scene durations derive from the storyboard's authored
 * hints or the same reading-speed math the pillar SRT uses; the storyboard's
 * structure carries over verbatim. What remains for the AI is exactly the
 * creative slots — `visual` (null until the scenes/effects stage fills it)
 * plus schema-bounded refinements at later stages.
 *
 * One-prompt mode runs on exactly these prefill defaults (auto-advanced);
 * advanced mode shows them to the operator first. Same function, two modes.
 */

export const DEFAULT_DIRECTION_ASPECT: DirectionAspect = "16:9";
export const DEFAULT_DIRECTION_FPS = 30;
export const DEFAULT_DIRECTION_PACING: DirectionPacing = "medium";
export const DEFAULT_DIRECTION_MOTION: DirectionMotion = "smooth";

/**
 * Storyboard fields are free-line text; direction fields are strict single
 * lines. This is the ONE normalization between them — whitespace runs
 * (incl. newlines) collapse to single spaces, trimmed — the same rule the
 * pillar SRT applies to cue text, so narration reads identically in both
 * artifacts.
 */
export function directionLineFrom(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Reads an enum-valued key from the free-form platform profile: absent ⇒ fallback; present-but-invalid ⇒ LOUD (a config typo must never silently become a default). */
function configEnum<T extends string>(
  profile: PlatformProfile | undefined,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = profile?.[key];
  if (raw === undefined) return fallback;
  if (typeof raw !== "string" || !(allowed as readonly string[]).includes(raw)) {
    throw new Error(
      `platform profile "${key}" is ${JSON.stringify(raw)} — expected one of ${allowed.join(" | ")}`,
    );
  }
  return raw as T;
}

function configFps(profile: PlatformProfile | undefined): number {
  const raw = profile?.fps;
  if (raw === undefined) return DEFAULT_DIRECTION_FPS;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 120) {
    throw new Error(`platform profile "fps" is ${JSON.stringify(raw)} — expected an integer 1–120`);
  }
  return raw;
}

export interface PrefillOptions {
  /** The tenant's platform profile for the draft's platform (free-form runtime config; B3.8). `aspect`/`fps`/`pacing`/`motion` keys are honoured when present. */
  platformProfile?: PlatformProfile;
}

export function prefillDirectionDoc(
  storyboard: Pick<StoryboardDraftMeta, "title" | "scenes" | "cta">,
  opts: PrefillOptions = {},
): DirectionDoc {
  const profile = opts.platformProfile;
  const motion = configEnum(profile, "motion", DIRECTION_MOTIONS, DEFAULT_DIRECTION_MOTION);
  return directionDocSchema.parse({
    docVersion: DIRECTION_DOC_VERSION,
    title: directionLineFrom(storyboard.title),
    aspect: configEnum(profile, "aspect", DIRECTION_ASPECTS, DEFAULT_DIRECTION_ASPECT),
    fps: configFps(profile),
    pacing: configEnum(profile, "pacing", DIRECTION_PACINGS, DEFAULT_DIRECTION_PACING),
    scenes: storyboard.scenes.map((scene) => ({
      sceneIndex: scene.sceneIndex,
      heading: directionLineFrom(scene.heading),
      narration: directionLineFrom(scene.narration),
      onScreenText: scene.onScreenText ? directionLineFrom(scene.onScreenText) : null,
      // The creative slot — deliberately empty until the scenes/effects
      // stage fills it. The storyboard's visualHint seeds that stage's
      // prompt, not this field (a hint is not a direction).
      visual: null,
      motion,
      durationMs: scene.durationHintMs ?? derivedCueDurationMs(scene.narration),
    })),
    cta: storyboard.cta ? directionLineFrom(storyboard.cta) : null,
  });
}
