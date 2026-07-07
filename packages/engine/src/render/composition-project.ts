import {
  COMPOSITION_GSAP_SRC,
  assertSpecRenderable,
  escapeHtml,
  hexToRgba,
  secondsLiteral,
  shiftHex,
  type CompositionSpec,
} from "./composition";
import {
  assertPacingDensity,
  planAccentPulses,
  type MotionEvent,
  type MotionSchedule,
} from "./composition-pacing";
import {
  emitSceneFile,
  planScene,
  sceneCompositionId,
  sceneFileName,
  sceneMotionEvents,
  type ScenePlan,
} from "./composition-scene";
import { TRANSITION_RECIPES } from "./composition-transitions";

/**
 * Composition v2's project emitter: spec → the complete multi-file
 * Hyperframes project — a root `index.html` that mounts one sub-composition
 * per cue (`data-composition-src`, the scene-per-beat cut) and owns the
 * BETWEEN-scene layer (curated transitions on the scene hosts, the brand
 * depth stack, audio clips, watermark), plus one scene file per cue
 * (./composition-scene.ts). Pure string assembly from validated inputs —
 * same spec, same bytes, always.
 *
 * Depth stack (engaging-clips §2 "depth and grade beat flat fills"), all
 * derived from the brand style DATA behind the character policy: a
 * gradient base + accent glow drift + vignette + GSAP-STEPPED film grain.
 * The grain texture is the registry `grain-overlay` item's generic SVG
 * feTurbulence data-URI (heygen-com/hyperframes, Apache-2.0, checked
 * 2026-07-07) — its CSS `infinite` keyframe animation is deliberately NOT
 * vendored: wall-clock CSS animation is invisible to the frame clock, so
 * the stepping is re-expressed as finite `tl.set` offsets on the paused
 * root timeline (seek-safe by construction).
 *
 * The pacing-density rule runs here, between planning and emission: scene
 * plans publish their scheduled visual changes, oversized gaps get accent
 * pulses inserted into the owning scene, and the final schedule is
 * re-asserted — see ./composition-pacing.ts.
 */

export interface CompositionProject {
  /** Relative path → file bytes; "index.html" is the root composition. */
  files: Record<string, string>;
  schedule: MotionSchedule;
}

/** The grain-overlay registry item's noise texture (a generic SVG filter def, data-URI — no fetch at render). */
const GRAIN_TEXTURE_URI =
  "data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E";

/** The catalog keyframe offsets, re-expressed as a finite deterministic cycle (xPercent/yPercent per step). */
const GRAIN_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [-5, -5],
  [-10, 5],
  [5, -10],
  [-5, 15],
  [15, 0],
  [0, 10],
  [-15, 0],
  [10, 5],
];
export const GRAIN_STEP_MS = 125;

const PULSE_MIN_LOCAL_MS = 120;
const PULSE_END_MARGIN_MS = 200;

function transitionTailMs(spec: CompositionSpec, cueIndex: number): number {
  if (cueIndex >= spec.cues.length - 1) return 0;
  return Math.round(TRANSITION_RECIPES[spec.cues[cueIndex + 1].transition].tailSec * 1000);
}

function assignPulses(spec: CompositionSpec, plans: ScenePlan[], pulses: number[]): MotionEvent[] {
  const materialized: MotionEvent[] = [];
  for (const atMs of pulses) {
    const plan =
      plans.find((p) => atMs >= p.cue.startMs && atMs < p.cue.endMs) ?? plans[plans.length - 1];
    let local = atMs - plan.cue.startMs;
    const maxLocal = plan.localDurationMs - PULSE_END_MARGIN_MS;
    local =
      maxLocal <= PULSE_MIN_LOCAL_MS
        ? Math.round(plan.localDurationMs / 2)
        : Math.max(PULSE_MIN_LOCAL_MS, Math.min(maxLocal, local));
    plan.pulses.push(local);
    materialized.push({ atMs: plan.cue.startMs + local, kind: "accent-pulse", cueIndex: plan.index });
  }
  void spec;
  return materialized;
}

function emitRootFile(spec: CompositionSpec, plans: ScenePlan[]): string {
  const durationSec = secondsLiteral(spec.durationMs);
  const usesFlash = spec.cues.some((cue, i) => i > 0 && TRANSITION_RECIPES[cue.transition].usesFlashOverlay);

  const hosts = plans
    .map((plan) => {
      const startSec = secondsLiteral(plan.cue.startMs);
      const durSec = secondsLiteral(plan.localDurationMs);
      return `      <div id="scene-host-${plan.index}" class="clip scene-host" data-composition-id="${sceneCompositionId(plan.index)}-host" data-start="${startSec}" data-duration="${durSec}" data-track-index="${10 + plan.index}" data-composition-src="${sceneFileName(plan.index)}" data-width="${spec.width}" data-height="${spec.height}"></div>`;
    })
    .join("\n");

  const audioTags: string[] = [];
  if (spec.audio) {
    spec.audio.narration.forEach((clip, i) => {
      if (!clip) return;
      const cue = spec.cues[i];
      const durMs = Math.min(clip.durationMs, cue.endMs - cue.startMs);
      audioTags.push(
        `      <audio id="narration-${i}" src="${clip.fileName}" data-start="${secondsLiteral(cue.startMs)}" data-duration="${secondsLiteral(durMs)}" data-track-index="0" data-volume="1"></audio>`,
      );
    });
    spec.audio.sfx.forEach((clip, i) => {
      if (!clip) return;
      const cue = spec.cues[i];
      const durMs = Math.min(1_500, cue.endMs - cue.startMs);
      audioTags.push(
        `      <audio id="sfx-${i}" src="${clip.fileName}" data-start="${secondsLiteral(cue.startMs)}" data-duration="${secondsLiteral(durMs)}" data-track-index="0" data-volume="0.6"></audio>`,
      );
    });
    if (spec.audio.bed) {
      const volume = Math.round(Math.max(0, Math.min(1, spec.audio.bed.volume)) * 100) / 100;
      audioTags.push(
        `      <audio id="music-bed" src="${spec.audio.bed.fileName}" data-start="0" data-duration="${durationSec}" data-track-index="0" data-volume="${volume}"></audio>`,
      );
    }
  }

  const transitionLines = plans.flatMap((plan) => {
    if (plan.index === 0) return [];
    const recipe = TRANSITION_RECIPES[plan.cue.transition];
    return recipe.emit({
      outSel: `#scene-host-${plan.index - 1}`,
      inSel: `#scene-host-${plan.index}`,
      atSec: secondsLiteral(plan.cue.startMs),
      width: spec.width,
      height: spec.height,
    });
  });

  const glowDx = Math.round(spec.width * 0.04);
  const glowDy = Math.round(spec.height * 0.05);
  const halfSec = secondsLiteral(Math.floor(spec.durationMs / 2));
  const glowLines = [
    `      tl.to("#bg-glow", { x: -${glowDx}, y: ${glowDy}, duration: ${halfSec}, ease: "sine.inOut" }, 0);`,
    `      tl.to("#bg-glow", { x: 0, y: 0, duration: ${halfSec}, ease: "sine.inOut" }, ${halfSec});`,
  ];

  const grainLines: string[] = [];
  for (let t = GRAIN_STEP_MS, step = 1; t < spec.durationMs; t += GRAIN_STEP_MS, step++) {
    const [x, y] = GRAIN_OFFSETS[step % GRAIN_OFFSETS.length];
    grainLines.push(`      tl.set(".grain-texture", { xPercent: ${x}, yPercent: ${y} }, ${secondsLiteral(t)});`);
  }

  const glowSize = Math.round(spec.width * 0.7);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${spec.width}, height=${spec.height}" />
    <title>${escapeHtml(spec.title)}</title>
    <script src="${COMPOSITION_GSAP_SRC}"></script>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html,
      body {
        margin: 0;
        width: ${spec.width}px;
        height: ${spec.height}px;
        overflow: hidden;
        background: ${spec.brand.background};
      }
      body {
        font-family: "${spec.brand.fontFamily}", sans-serif;
        color: ${spec.brand.textColor};
      }
      #bg-depth {
        position: absolute;
        inset: 0;
        background: linear-gradient(165deg, ${shiftHex(spec.brand.background, 0.1)} 0%, ${spec.brand.background} 52%, ${shiftHex(spec.brand.background, -0.12)} 100%);
      }
      #bg-glow {
        position: absolute;
        top: ${-Math.round(glowSize * 0.25)}px;
        right: ${-Math.round(glowSize * 0.2)}px;
        width: ${glowSize}px;
        height: ${glowSize}px;
        border-radius: 50%;
        background: radial-gradient(circle, ${hexToRgba(spec.brand.accentColor, 0.16)} 0%, ${hexToRgba(spec.brand.accentColor, 0)} 65%);
      }
      .scene-host {
        position: absolute;
        inset: 0;
        overflow: hidden;
      }
      #vignette {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 90;
        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 45%, rgba(0, 0, 0, 0.55) 100%);
      }
      #grain {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 100;
      }
      #grain .grain-texture {
        /* 150% w/ -25% offsets: the ±15% GSAP steps never expose an edge, at half the raster memory of the catalog's 200%. */
        position: absolute;
        top: -25%;
        left: -25%;
        width: 150%;
        height: 150%;
        background: url("${GRAIN_TEXTURE_URI}");
        opacity: 0.09;
      }
${usesFlash ? `      #transition-flash {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 120;
        background: #ffffff;
        opacity: 0;
      }
` : ""}      #brand-watermark {
        position: absolute;
        left: ${Math.round(spec.width / 48)}px;
        bottom: ${Math.round(spec.height / 27)}px;
        font-size: ${Math.round(spec.height / 45)}px;
        letter-spacing: 0.08em;
        opacity: 0.6;
        z-index: 130;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="${spec.compositionId}"
      data-start="0"
      data-duration="${durationSec}"
      data-width="${spec.width}"
      data-height="${spec.height}"
    >
      <div id="bg-depth"></div>
      <div id="bg-glow"></div>
${hosts}
${audioTags.length > 0 ? `${audioTags.join("\n")}\n` : ""}      <div id="vignette"></div>
      <div id="grain"><div class="grain-texture"></div></div>
${usesFlash ? `      <div id="transition-flash"></div>\n` : ""}${
    spec.brand.watermark
      ? `      <div id="brand-watermark" class="clip" data-start="0" data-duration="${durationSec}" data-track-index="130">${escapeHtml(spec.brand.watermark)}</div>\n`
      : ""
  }    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
${[...transitionLines, ...glowLines, ...grainLines].join("\n")}
      tl.set({}, {}, ${durationSec});
      window.__timelines["${spec.compositionId}"] = tl;
    </script>
  </body>
</html>
`;
}

/**
 * Composition spec → the complete project: plan scenes → measure pacing →
 * insert accent pulses → assert density → emit every file. The returned
 * schedule is the density rule's evidence — tests pin it, and the assert
 * inside makes a violating template a generator error instead of a stale
 * render.
 */
export function renderCompositionProject(spec: CompositionSpec): CompositionProject {
  assertSpecRenderable(spec);
  if (spec.audio) {
    for (const [name, arr] of [
      ["narration", spec.audio.narration],
      ["sfx", spec.audio.sfx],
    ] as const) {
      if (arr.length !== spec.cues.length) {
        throw new Error(
          `composition audio.${name} carries ${arr.length} entries for ${spec.cues.length} cues — audio tracks align by cue index`,
        );
      }
    }
  }

  const plans = spec.cues.map((cue, i) =>
    planScene(spec, cue, i, transitionTailMs(spec, i), spec.audio?.narration[i] ?? null),
  );

  const events: MotionEvent[] = plans.flatMap(sceneMotionEvents);
  plans.forEach((plan) => {
    if (plan.index > 0 && plan.cue.transition !== "cut") {
      events.push({ atMs: plan.cue.startMs, kind: "transition", cueIndex: null });
    }
  });

  const window = { durationMs: spec.durationMs, hookEndMs: spec.cues[0].endMs };
  const pulses = assignPulses(spec, plans, planAccentPulses(events, window));
  const schedule = assertPacingDensity([...events, ...pulses], window);

  const files: Record<string, string> = { "index.html": emitRootFile(spec, plans) };
  for (const plan of plans) {
    files[sceneFileName(plan.index)] = emitSceneFile(spec, plan);
  }
  return { files, schedule };
}

export { sceneCompositionId, sceneFileName };
