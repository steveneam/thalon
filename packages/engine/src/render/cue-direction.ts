import type { DirectionMotion } from "@thalon/contracts";
import type { CompositionTransition } from "./composition-transitions";
import type { PillarTimeline } from "./srt";

/**
 * Composition-v2 cue decoration for the PILLAR path: per-beat
 * motion/transition/sfx arrive as DATA (demo-clip specs today, any future
 * authored source tomorrow) and are folded onto a derived timeline AFTER
 * derivation — derivePillarTimeline itself stays byte-untouched, so every
 * pinned SRT and every pinned render-manifest hash built from an
 * UNDECORATED timeline is provably unchanged (the optional fields simply
 * never exist under stableStringify). The direction-doc path needs none of
 * this: its scenes already carry motion in the contract.
 */

export interface CueDirective {
  motion?: DirectionMotion;
  /** How the cue's scene ENTERS (ignored on the hook — nothing precedes it). */
  transition?: CompositionTransition;
  /** Operator SFX-pack accent id — resolved outside the repo (packs are operator data, never in-tree). */
  sfx?: string;
}

export interface CueDirectives {
  hook?: CueDirective;
  /** Keyed by beatIndex. */
  beats?: Record<number, CueDirective>;
  cta?: CueDirective;
}

export function applyCueDirection(timeline: PillarTimeline, directives: CueDirectives): PillarTimeline {
  return {
    totalDurationMs: timeline.totalDurationMs,
    cues: timeline.cues.map((cue) => {
      const directive =
        cue.kind === "hook"
          ? directives.hook
          : cue.kind === "cta"
            ? directives.cta
            : directives.beats?.[cue.beatIndex ?? -1];
      if (!directive) return cue;
      return {
        ...cue,
        ...(directive.motion !== undefined ? { motion: directive.motion } : {}),
        ...(directive.transition !== undefined ? { transition: directive.transition } : {}),
        ...(directive.sfx !== undefined ? { sfx: directive.sfx } : {}),
      };
    }),
  };
}
