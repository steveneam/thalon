import type { DirectionMotion, DirectionPacing } from "@thalon/contracts";
import type { DirectionExport } from "../direction/export";
import type { PillarRenderManifest } from "./target";

/**
 * B5.1 deterministic HTML composition generator (amendment A11; SPINE §1
 * core — no I/O, no clock; same spec in, same bytes out). One template, two
 * deterministic entry mappings: the B3.10 pillar render manifest and the
 * B5.2 direction export. The composition contract is Hyperframes' (pinned
 * by `docs/research/hyperframes-integration.md` and verified against the
 * official `hyperframes init` scaffold at 0.7.33):
 *
 *   - root `<div id="root" data-composition-id data-start="0"
 *     data-duration data-width data-height>` — width/height/duration are
 *     COMPILE-TIME literals baked from the manifest/direction export, never
 *     script- or variable-settable (fps is baked into the render job the
 *     same way; it is a producer parameter, not markup).
 *   - every visual element is a `class="clip"` div with literal
 *     `data-start`/`data-duration` seconds (framework-managed visibility).
 *   - one GSAP timeline, created `paused: true`, registered under
 *     `window.__timelines[<composition-id>]`, absolute-positioned tweens
 *     only, end-padded so timeline duration == composition duration.
 *
 * The forbidden patterns (Date.now / rAF / Math.random / render-time
 * fetches / media playback control / non-paused or infinite timelines /
 * script-set root duration) are impossible BY CONSTRUCTION: the only
 * script this template emits is the fixed timeline block below, built
 * from enum-mapped easings and numeric offsets; all judged content is
 * HTML-escaped into markup, never into script. ./composition-lint.ts is
 * the belt-and-braces re-check.
 *
 * Brand styling is DATA from the tenant's active profile identity (never
 * code): the optional `identity.style` object may carry `background`,
 * `textColor`, `accentColor`, `fontFamily` — each validated against a
 * strict character policy (an invalid value falls back to the generic
 * default, so tenant data can never break out of its CSS slot).
 */

/** The exact GSAP runtime the official `hyperframes init` scaffold pins (loaded in <head>, before the frame clock — a preload, not a render-time fetch). Bump only with the package pin (ADR-0004). */
export const COMPOSITION_GSAP_SRC = "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js";

/** Pillar compile-time constants (the pillar manifest predates aspect/fps config; direction docs carry their own). */
export const PILLAR_COMPOSITION = { width: 1920, height: 1080, fps: 30 } as const;
export const PILLAR_COMPOSITION_PACING: DirectionPacing = "medium";
export const DEFAULT_CUE_MOTION: DirectionMotion = "smooth";

/**
 * The deterministic motion-enum → GSAP easing mapping (the contracts
 * direction-doc schema promises this lives in the render driver). Enum-total
 * by type: a new DirectionMotion fails typecheck here until it is mapped.
 */
export const MOTION_EASING: Record<DirectionMotion, string> = {
  smooth: "power2.out",
  snappy: "power4.out",
  bouncy: "back.out(1.7)",
  dramatic: "expo.inOut",
};

/** Document pacing → per-cue entrance tween seconds (the research doc's pinned vocabulary: fast 0.2s · medium 0.4s · slow 0.6s). */
export const PACING_SECONDS: Record<DirectionPacing, number> = {
  fast: 0.2,
  medium: 0.4,
  slow: 0.6,
};

export interface CompositionCue {
  /** Small kicker line above the narration (direction scenes only). */
  heading: string | null;
  /** The narrated line — the cue's main on-screen copy. */
  text: string;
  /** Emphasized overlay copy (accent-colored). */
  onScreenText: string | null;
  motion: DirectionMotion;
  startMs: number;
  endMs: number;
}

export interface CompositionBrandStyle {
  background: string;
  textColor: string;
  accentColor: string;
  /** Family name only (quoted at render); generic fallback appended. */
  fontFamily: string;
  /** Company name rendered as a full-duration watermark; null omits the clip. */
  watermark: string | null;
}

/** The complete, self-contained input renderCompositionHtml consumes — everything compile-time, nothing left to the render environment. */
export interface CompositionSpec {
  compositionId: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  pacing: DirectionPacing;
  brand: CompositionBrandStyle;
  cues: CompositionCue[];
}

export const GENERIC_BRAND_STYLE: Omit<CompositionBrandStyle, "watermark"> = {
  background: "#0b0d12",
  textColor: "#f5f7fa",
  accentColor: "#7aa2ff",
  fontFamily: "Inter",
};

const COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FONT_FAMILY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]{0,60}$/;

function styleString(value: unknown, pattern: RegExp, fallback: string): string {
  return typeof value === "string" && pattern.test(value) ? value : fallback;
}

/**
 * Brand identity (data) → the composition's style tokens. Reads the optional
 * `identity.style` extension point; every value is validated against a
 * strict pattern so profile data can only ever fill its slot, never escape
 * it — an unparseable value silently falls back to the generic default
 * (styling is presentation, not a claim surface; nothing here is judged).
 */
export function deriveBrandStyle(identity: Record<string, unknown>): CompositionBrandStyle {
  const style =
    typeof identity.style === "object" && identity.style !== null
      ? (identity.style as Record<string, unknown>)
      : {};
  const company = typeof identity.company === "string" ? identity.company.trim() : "";
  return {
    background: styleString(style.background, COLOR_PATTERN, GENERIC_BRAND_STYLE.background),
    textColor: styleString(style.textColor, COLOR_PATTERN, GENERIC_BRAND_STYLE.textColor),
    accentColor: styleString(style.accentColor, COLOR_PATTERN, GENERIC_BRAND_STYLE.accentColor),
    fontFamily: styleString(style.fontFamily, FONT_FAMILY_PATTERN, GENERIC_BRAND_STYLE.fontFamily),
    watermark: company || null,
  };
}

function assertPositiveInt(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`composition ${name} must be a positive integer, got ${value}`);
  }
}

const COMPOSITION_ID_PATTERN = /^[a-z][a-z0-9-]{0,40}$/;

/**
 * Every value the template interpolates OUTSIDE an HTML-escaped text slot
 * (attribute ids, CSS tokens, script string literals) is re-validated here —
 * deriveBrandStyle already enforces the patterns, but the renderer must hold
 * its own invariant against hand-built specs.
 */
function assertSpecRenderable(spec: CompositionSpec): void {
  assertPositiveInt("width", spec.width);
  assertPositiveInt("height", spec.height);
  assertPositiveInt("fps", spec.fps);
  assertPositiveInt("durationMs", spec.durationMs);
  if (spec.cues.length === 0) {
    throw new Error("composition has no cues — an empty timeline renders nothing; refusing before any render spend");
  }
  if (!COMPOSITION_ID_PATTERN.test(spec.compositionId)) {
    throw new Error(`composition id "${spec.compositionId}" must match ${COMPOSITION_ID_PATTERN}`);
  }
  for (const [name, value, pattern] of [
    ["background", spec.brand.background, COLOR_PATTERN],
    ["textColor", spec.brand.textColor, COLOR_PATTERN],
    ["accentColor", spec.brand.accentColor, COLOR_PATTERN],
    ["fontFamily", spec.brand.fontFamily, FONT_FAMILY_PATTERN],
  ] as const) {
    if (!pattern.test(value)) {
      throw new Error(`composition brand ${name} "${value}" fails its character policy — style tokens must come through deriveBrandStyle`);
    }
  }
}

/** The B3.10 seam's mapping: pillar render manifest → composition spec (pillar constants are compile-time; brand styling from the manifest's render-time ACTIVE identity). */
export function compositionSpecFromPillarManifest(manifest: PillarRenderManifest): CompositionSpec {
  return {
    compositionId: "main",
    title: manifest.title,
    width: PILLAR_COMPOSITION.width,
    height: PILLAR_COMPOSITION.height,
    fps: PILLAR_COMPOSITION.fps,
    durationMs: manifest.timeline.totalDurationMs,
    pacing: PILLAR_COMPOSITION_PACING,
    brand: deriveBrandStyle(manifest.brand.identity),
    cues: manifest.timeline.cues.map((cue) => ({
      heading: null,
      text: cue.text,
      onScreenText: cue.onScreenText,
      motion: DEFAULT_CUE_MOTION,
      startMs: cue.startMs,
      endMs: cue.endMs,
    })),
  };
}

/** The B5.2 staged-video mapping: direction export → composition spec. Width/height/fps/pacing come from the export (aspect-derived, config-prefilled) — compile-time by construction. */
export function compositionSpecFromDirectionExport(
  exported: DirectionExport,
  identity: Record<string, unknown>,
): CompositionSpec {
  return {
    compositionId: "main",
    title: exported.title,
    width: exported.width,
    height: exported.height,
    fps: exported.fps,
    durationMs: exported.timeline.totalDurationMs,
    pacing: exported.pacing,
    brand: deriveBrandStyle(identity),
    cues: exported.timeline.cues.map((cue) => ({
      heading: cue.heading,
      text: cue.text,
      onScreenText: cue.onScreenText,
      motion: cue.motion ?? DEFAULT_CUE_MOTION,
      startMs: cue.startMs,
      endMs: cue.endMs,
    })),
  };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Integer ms → a canonical decimal-seconds literal ("10", "1.5", "12.345") — deterministic bytes for data-* attributes and timeline offsets. */
export function secondsLiteral(ms: number): string {
  if (!Number.isInteger(ms) || ms < 0) throw new Error(`invalid composition milliseconds: ${ms}`);
  return (ms / 1000).toFixed(3).replace(/\.?0+$/, "");
}

/**
 * Composition spec → the complete single-file HTML composition. Pure string
 * assembly from validated inputs; the bytes are what the render cache's
 * determinism rests on (same manifest → same manifest hash → same HTML).
 */
export function renderCompositionHtml(spec: CompositionSpec): string {
  assertSpecRenderable(spec);
  const durationSec = secondsLiteral(spec.durationMs);
  const pacingSec = PACING_SECONDS[spec.pacing];

  const clips: string[] = [];
  if (spec.brand.watermark) {
    clips.push(
      `      <div id="brand-watermark" class="clip" data-start="0" data-duration="${durationSec}" data-track-index="1">${escapeHtml(spec.brand.watermark)}</div>`,
    );
  }
  spec.cues.forEach((cue, i) => {
    const parts: string[] = [];
    if (cue.heading) parts.push(`<div class="cue-heading">${escapeHtml(cue.heading)}</div>`);
    if (cue.onScreenText) {
      parts.push(`<div class="cue-on-screen">${escapeHtml(cue.onScreenText)}</div>`);
    }
    parts.push(`<div class="cue-text">${escapeHtml(cue.text)}</div>`);
    clips.push(
      `      <div id="cue-${i}" class="clip cue" data-start="${secondsLiteral(cue.startMs)}" data-duration="${secondsLiteral(cue.endMs - cue.startMs)}" data-track-index="2">\n        ${parts.join("\n        ")}\n      </div>`,
    );
  });

  const tweens = spec.cues
    .map(
      (cue, i) =>
        `      tl.from("#cue-${i}", { opacity: 0, y: 24, duration: ${pacingSec}, ease: "${MOTION_EASING[cue.motion]}" }, ${secondsLiteral(cue.startMs)});`,
    )
    .join("\n");

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
      .cue {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: ${Math.round(spec.height / 12)}px ${Math.round(spec.width / 10)}px;
      }
      .cue-heading {
        font-size: ${Math.round(spec.height / 36)}px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        opacity: 0.7;
        margin-bottom: ${Math.round(spec.height / 45)}px;
      }
      .cue-on-screen {
        font-size: ${Math.round(spec.height / 15)}px;
        font-weight: 700;
        color: ${spec.brand.accentColor};
        margin-bottom: ${Math.round(spec.height / 30)}px;
      }
      .cue-text {
        font-size: ${Math.round(spec.height / 22)}px;
        line-height: 1.35;
        max-width: ${Math.round(spec.width * 0.8)}px;
      }
      #brand-watermark {
        position: absolute;
        left: ${Math.round(spec.width / 48)}px;
        bottom: ${Math.round(spec.height / 27)}px;
        font-size: ${Math.round(spec.height / 45)}px;
        letter-spacing: 0.08em;
        opacity: 0.6;
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
${clips.join("\n")}
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
${tweens}
      tl.set({}, {}, ${durationSec});
      window.__timelines["${spec.compositionId}"] = tl;
    </script>
  </body>
</html>
`;
}
