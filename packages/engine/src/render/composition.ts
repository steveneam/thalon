import type { DirectionMotion, DirectionPacing } from "@thalon/contracts";
import type { DirectionExport } from "../direction/export";
import type { PillarRenderManifest } from "./target";
import { defaultTransition, type CompositionTransition } from "./composition-transitions";

/**
 * The deterministic composition SPEC model (B5.1, raised to composition v2
 * in Sprint 6 wave 3.5; SPINE §1 core — no I/O, no clock; same spec in,
 * same bytes out). One spec, two deterministic entry mappings: the B3.10
 * pillar render manifest and the B5.2 direction export. The HTML emission
 * itself lives in ./composition-project.ts (scene-per-beat sub-compositions
 * per the Hyperframes contract pinned by
 * docs/research/hyperframes-integration.md and re-verified at 0.7.33).
 *
 * v2 raises the craft floor for EVERY video the engine renders
 * (docs/research/engaging-clips.md §5 item 1):
 *   - per-cue MOTION comes from data (direction scenes / decorated pillar
 *     cues), with a deterministic varied fallback — no more pinning every
 *     cue to "smooth";
 *   - per-cue TRANSITION selects from the curated catalog-derived enum
 *     (./composition-transitions.ts), deterministic cycle when unauthored;
 *   - optional per-cue narration audio + word timings (the TTS seam,
 *     ./narration.ts) drive karaoke captions and <audio> clips.
 *
 * The forbidden patterns (Date.now / rAF / Math.random / render-time
 * fetches / media playback control / non-paused or infinite timelines /
 * script-set root duration) stay impossible BY CONSTRUCTION: the emitters
 * assemble fixed tween vocabularies from enum-mapped easings and numeric
 * offsets; all judged content is HTML-escaped into markup, never into
 * script. ./composition-lint.ts is the belt-and-braces re-check.
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

/**
 * The v2 fallback when a cue carries NO authored motion: a deterministic
 * varied assignment (hook punches, CTA lands, beats alternate) instead of
 * pinning everything to "smooth". Authored motion always wins.
 */
export function defaultCueMotion(cueIndex: number, cueCount: number): DirectionMotion {
  if (cueIndex === 0) return "snappy";
  if (cueIndex === cueCount - 1) return "dramatic";
  return cueIndex % 2 === 1 ? "smooth" : "snappy";
}

/** One word of a cue's caption, cue-relative ms — from real TTS word alignment when the audio seam is armed, else deterministically estimated. */
export interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
}

/** A cue's narration clip as the composition consumes it: a file NAME under the project's audio/ dir (the render target writes the bytes) + timings. */
export interface CueNarrationClip {
  fileName: string;
  durationMs: number;
  words: CaptionWord[];
}

/**
 * The composition's audio track set — all optional, all data. `bed` is the
 * honest empty seam for audio v2.5's operator-licensed music (engaging-clips
 * §6 rung 1): the mount exists, nothing in-tree ever provides a file.
 */
export interface CompositionAudio {
  /** By cue index; null = silent cue. */
  narration: Array<CueNarrationClip | null>;
  /** By cue index; accent SFX are operator-pack data resolved outside the composition. */
  sfx: Array<{ fileName: string } | null>;
  bed: { fileName: string; volume: number } | null;
}

export interface CompositionCue {
  /** Small kicker line above the narration (direction scenes only). */
  heading: string | null;
  /** The narrated line — the cue's main on-screen copy. */
  text: string;
  /** Emphasized overlay copy (accent-colored; a leading integer renders as a count-up stat block). */
  onScreenText: string | null;
  motion: DirectionMotion;
  /** How this cue's scene ENTERS (ignored for cue 0 — nothing precedes it). */
  transition: CompositionTransition;
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

/** The complete, self-contained input the project emitter consumes — everything compile-time, nothing left to the render environment. */
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
  /** null = today's silent composition; set by the render target when its audio seam is armed. */
  audio: CompositionAudio | null;
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
 * Audio file names are template slots, so they carry their own character
 * policy. The extension list widened at B-audio.1 (s77) from `.wav` alone to
 * the contract's audio family: narration is synthesized WAV and always will
 * be, but an operator's music bed arrives as whatever they licensed, and
 * re-encoding someone's master to satisfy a regex would be the render lying
 * about the bytes it was given.
 */
const AUDIO_FILE_NAME_PATTERN = /^audio\/[a-z0-9][a-z0-9-]*\.(?:wav|mp3|m4a)$/;

/**
 * Every value the template interpolates OUTSIDE an HTML-escaped text slot
 * (attribute ids, CSS tokens, script string literals, audio file names) is
 * re-validated here — deriveBrandStyle already enforces the patterns, but
 * the emitter must hold its own invariant against hand-built specs.
 */
export function assertSpecRenderable(spec: CompositionSpec): void {
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
  if (spec.audio) {
    const names = [
      ...spec.audio.narration.filter((n) => n !== null).map((n) => n.fileName),
      ...spec.audio.sfx.filter((s) => s !== null).map((s) => s.fileName),
      ...(spec.audio.bed ? [spec.audio.bed.fileName] : []),
    ];
    for (const fileName of names) {
      if (!AUDIO_FILE_NAME_PATTERN.test(fileName)) {
        throw new Error(`composition audio file name "${fileName}" must match ${AUDIO_FILE_NAME_PATTERN} — names are template slots, the render target writes the bytes`);
      }
    }
  }
}

/** The B3.10 seam's mapping: pillar render manifest → composition spec (pillar constants are compile-time; brand styling from the manifest's render-time ACTIVE identity; motion/transition from decorated cues when present, deterministic defaults otherwise). */
export function compositionSpecFromPillarManifest(manifest: PillarRenderManifest): CompositionSpec {
  const count = manifest.timeline.cues.length;
  return {
    compositionId: "main",
    title: manifest.title,
    width: PILLAR_COMPOSITION.width,
    height: PILLAR_COMPOSITION.height,
    fps: PILLAR_COMPOSITION.fps,
    durationMs: manifest.timeline.totalDurationMs,
    pacing: PILLAR_COMPOSITION_PACING,
    brand: deriveBrandStyle(manifest.brand.identity),
    cues: manifest.timeline.cues.map((cue, i) => ({
      heading: null,
      text: cue.text,
      onScreenText: cue.onScreenText,
      motion: cue.motion ?? defaultCueMotion(i, count),
      transition: cue.transition ?? defaultTransition(i),
      startMs: cue.startMs,
      endMs: cue.endMs,
    })),
    audio: null,
  };
}

/** The B5.2 staged-video mapping: direction export → composition spec. Width/height/fps/pacing come from the export (aspect-derived, config-prefilled) — compile-time by construction. */
export function compositionSpecFromDirectionExport(
  exported: DirectionExport,
  identity: Record<string, unknown>,
): CompositionSpec {
  const count = exported.timeline.cues.length;
  return {
    compositionId: "main",
    title: exported.title,
    width: exported.width,
    height: exported.height,
    fps: exported.fps,
    durationMs: exported.timeline.totalDurationMs,
    pacing: exported.pacing,
    brand: deriveBrandStyle(identity),
    cues: exported.timeline.cues.map((cue, i) => ({
      heading: cue.heading,
      text: cue.text,
      onScreenText: cue.onScreenText,
      motion: cue.motion ?? defaultCueMotion(i, count),
      transition: defaultTransition(i),
      startMs: cue.startMs,
      endMs: cue.endMs,
    })),
    audio: null,
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

/** Policy-validated hex (#rgb/#rrggbb, alpha channels ignored) → a canonical rgba() literal — the deterministic way brand colors pick up template-owned opacity. */
export function hexToRgba(hex: string, alpha: number): string {
  const body = hex.slice(1);
  const full = body.length === 3 || body.length === 4 ? body.split("").map((c) => c + c).join("") : body;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Deterministic lighten/darken for the depth gradient: shifts each channel toward white (positive) or black (negative) by `amount` 0–1, output canonical #rrggbb. */
export function shiftHex(hex: string, amount: number): string {
  const body = hex.slice(1);
  const full = body.length === 3 || body.length === 4 ? body.split("").map((c) => c + c).join("") : body;
  const shift = (channel: number) =>
    amount >= 0
      ? Math.round(channel + (255 - channel) * amount)
      : Math.round(channel * (1 + amount));
  const out = [full.slice(0, 2), full.slice(2, 4), full.slice(4, 6)]
    .map((pair) => shift(parseInt(pair, 16)).toString(16).padStart(2, "0"))
    .join("");
  return `#${out}`;
}
