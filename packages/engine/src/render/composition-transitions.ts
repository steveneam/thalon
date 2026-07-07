/**
 * Composition v2 (Sprint 6 wave 3.5): the curated scene-transition enum —
 * a deterministic, catalog-derived subset of the Hyperframes registry's
 * transition families, vendored as DATA (parameterized tween recipes), never
 * as copied snippet bytes. Each recipe is a pure emitter: scene selectors +
 * a boundary time in, canonical GSAP timeline lines out — so the generator
 * stays same-spec-same-bytes and the two-belt lint gate keeps holding by
 * construction (the emitters can only produce the tween vocabulary below).
 *
 * Catalog-adoption gate (repo rule: record each check): the recipes were
 * re-derived 2026-07-07 from registry items fetched via the pinned
 * `hyperframes add` (0.7.33) from
 * https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry —
 * the heygen-com/hyperframes repository, whose root LICENSE was verified
 * Apache-2.0 the same day (items carry no per-file license header; the repo
 * license governs). No snippet HTML/JS is embedded in this repo: each
 * family's tween grammar (properties, easings, durations) was re-expressed
 * as the parameterized data below. Provenance per entry in `provenance`.
 */

export const COMPOSITION_TRANSITIONS = [
  "cut",
  "dissolve",
  "push",
  "push-up",
  "blur",
  "scale",
  "flash",
] as const;
export type CompositionTransition = (typeof COMPOSITION_TRANSITIONS)[number];

export interface TransitionProvenance {
  /** Registry item the recipe grammar was derived from; null = own synthesis (no upstream bytes involved). */
  registryItem: string | null;
  source: string;
  license: string;
  /** Date the adoption-gate license check ran. */
  verified: string;
}

const REGISTRY_SOURCE =
  "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry (repo root LICENSE)";
const CHECKED = { source: REGISTRY_SOURCE, license: "Apache-2.0", verified: "2026-07-07" };

/** Context a recipe emits against. Times are CANONICAL second literals (secondsLiteral output) so emitted bytes stay deterministic. */
export interface TransitionEmitContext {
  /** Outgoing scene-host selector (e.g. "#scene-host-2"); null when the transition opens the video (nothing leaves). */
  outSel: string | null;
  /** Incoming scene-host selector. */
  inSel: string;
  /** Boundary time literal in seconds — the incoming cue's start. */
  atSec: string;
  width: number;
  height: number;
}

export interface TransitionRecipe {
  /** Seconds the OUTGOING scene must stay mounted past the boundary (its host + sub-composition are extended by this). */
  tailSec: number;
  /** True when the recipe tweens the shared #transition-flash overlay (the root emits it once if any used recipe needs it). */
  usesFlashOverlay: boolean;
  provenance: TransitionProvenance;
  /** Root-timeline lines (indented, `;`-terminated) realizing the transition at the boundary. */
  emit(ctx: TransitionEmitContext): string[];
}

const line = (s: string) => `      ${s}`;

/**
 * The recipe table — enum-total by type (a new CompositionTransition fails
 * typecheck here until mapped). Durations/easings are the studied families'
 * pinned values; every emitted tween targets only opacity/x/y/scale/filter
 * on scene hosts (or the flash overlay), which the frame-seek capture
 * replays exactly.
 */
export const TRANSITION_RECIPES: Record<CompositionTransition, TransitionRecipe> = {
  cut: {
    tailSec: 0,
    usesFlashOverlay: false,
    provenance: { registryItem: null, source: "own synthesis (hard cut — no motion)", license: "n/a", verified: "2026-07-07" },
    emit: () => [],
  },
  dissolve: {
    tailSec: 0.5,
    usesFlashOverlay: false,
    provenance: { registryItem: "transitions-dissolve", ...CHECKED },
    emit: ({ outSel, inSel, atSec }) => [
      ...(outSel ? [line(`tl.to("${outSel}", { opacity: 0, duration: 0.5, ease: "power2.inOut" }, ${atSec});`)] : []),
      line(`tl.fromTo("${inSel}", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.inOut" }, ${atSec});`),
    ],
  },
  push: {
    tailSec: 0.5,
    usesFlashOverlay: false,
    provenance: { registryItem: "transitions-push", ...CHECKED },
    emit: ({ outSel, inSel, atSec, width }) => [
      ...(outSel ? [line(`tl.to("${outSel}", { x: -${width}, duration: 0.5, ease: "power3.inOut" }, ${atSec});`)] : []),
      line(`tl.fromTo("${inSel}", { x: ${width} }, { x: 0, duration: 0.5, ease: "power3.inOut" }, ${atSec});`),
    ],
  },
  "push-up": {
    tailSec: 0.5,
    usesFlashOverlay: false,
    provenance: { registryItem: "transitions-push", ...CHECKED },
    emit: ({ outSel, inSel, atSec, height }) => [
      ...(outSel ? [line(`tl.to("${outSel}", { y: -${height}, duration: 0.5, ease: "power3.inOut" }, ${atSec});`)] : []),
      line(`tl.fromTo("${inSel}", { y: ${height} }, { y: 0, duration: 0.5, ease: "power3.inOut" }, ${atSec});`),
    ],
  },
  blur: {
    tailSec: 0.7,
    usesFlashOverlay: false,
    provenance: { registryItem: "transitions-blur", ...CHECKED },
    emit: ({ outSel, inSel, atSec }) => [
      ...(outSel
        ? [
            line(`tl.to("${outSel}", { filter: "blur(24px)", scale: 1.06, duration: 0.5, ease: "power1.in" }, ${atSec});`),
            line(`tl.to("${outSel}", { opacity: 0, duration: 0.3, ease: "power1.in" }, ${atSec} + 0.3);`),
          ]
        : []),
      line(
        `tl.fromTo("${inSel}", { opacity: 0, filter: "blur(18px)", scale: 1.04 }, { opacity: 1, filter: "blur(0px)", scale: 1, duration: 0.7, ease: "power1.out" }, ${atSec});`,
      ),
    ],
  },
  scale: {
    tailSec: 0.5,
    usesFlashOverlay: false,
    provenance: { registryItem: "transitions-scale", ...CHECKED },
    emit: ({ outSel, inSel, atSec }) => [
      ...(outSel ? [line(`tl.to("${outSel}", { scale: 1.12, opacity: 0, duration: 0.4, ease: "power2.in" }, ${atSec});`)] : []),
      line(`tl.fromTo("${inSel}", { scale: 0.92, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "power3.out" }, ${atSec});`),
    ],
  },
  flash: {
    tailSec: 0.45,
    usesFlashOverlay: true,
    provenance: {
      registryItem: null,
      source: "own synthesis (plain-overlay nod to the catalog's shader Flash Through White — no shader, no upstream bytes)",
      license: "n/a",
      verified: "2026-07-07",
    },
    emit: ({ outSel, inSel, atSec }) => [
      line(`tl.fromTo("#transition-flash", { opacity: 0 }, { opacity: 0.9, duration: 0.1, ease: "power2.in" }, ${atSec});`),
      line(`tl.to("#transition-flash", { opacity: 0, duration: 0.35, ease: "power2.out" }, ${atSec} + 0.1);`),
      ...(outSel ? [line(`tl.set("${outSel}", { opacity: 0 }, ${atSec} + 0.1);`)] : []),
      line(`tl.fromTo("${inSel}", { opacity: 0 }, { opacity: 1, duration: 0.05, ease: "none" }, ${atSec} + 0.08);`),
    ],
  },
};

/**
 * The deterministic fallback when a cue carries no authored transition —
 * a fixed rotation so every video the engine renders gets scene variety
 * without any data change (data always wins when present).
 */
export const DEFAULT_TRANSITION_CYCLE: readonly CompositionTransition[] = [
  "push",
  "dissolve",
  "scale",
  "push-up",
  "blur",
  "flash",
];

/** Scene index (1-based position of the ENTERING scene; 0 = the opening scene, which never transitions in). */
export function defaultTransition(enteringSceneIndex: number): CompositionTransition {
  if (enteringSceneIndex <= 0) return "cut";
  return DEFAULT_TRANSITION_CYCLE[(enteringSceneIndex - 1) % DEFAULT_TRANSITION_CYCLE.length];
}
