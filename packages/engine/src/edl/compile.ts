import {
  edlSchema,
  type AudioCue,
  type CaptionStyle,
  type Edl,
  type EdlClip,
  type EdlInput,
  type Pan,
} from "@thalon/contracts";
import type { EdlPlan, PlanInput, PlateSpec } from "./plan";

/**
 * B-ve.1 (ADR 0010): EDL → ffmpeg-filtergraph compiler — deterministic
 * core, zero vendor credits by construction. The lowering is the two film
 * recipes' machinery made canonical:
 *
 * - beat lane: per-clip normalize (crop → grade → scale → setsar/fps/
 *   format) when the lane assembles multiple beats; xfade chain with
 *   offsets DERIVED from durations (offset_k = offset_{k-1} + dur_k −
 *   fade_k); a single bare clip passes through untouched (the 16:9 v6
 *   caption pass layers straight over a prior cut).
 * - caption lane: one plate per line (magick: text → black backing + glow
 *   → flatten), alpha fade windows, overlay at center-relative offsets.
 * - overlay-fade (the v6 endcard machinery, xfade BANNED at trim
 *   boundaries — s44 lesson): the composed timeline is trimmed at `at`,
 *   frozen by clone-hold to the output duration, and the clip alpha-fades
 *   in on top.
 * - music lane: stream-copy (identical timeline, the 9:16 mux) or encode
 *   with offset + STATIC gain + anti-click tail easing only.
 *
 * Filtergraph STRINGS are canonical, not byte-mimicry of the hand recipes —
 * equivalence is proven at the decoded-stream level by the replay test
 * (film-replay.test.ts), while the golden tests pin the compiled plan text.
 *
 * Honest caps (fail loud, extend additively when a cut needs them):
 * at most ONE overlay-fade clip (last on the lane) and ONE audio cue;
 * beats after the first must declare an xfade transition.
 */

/** The recipes' `round(x, 6)` — derived times never carry float dust into the graph. */
function fmt(n: number): string {
  return String(Math.round(n * 1e6) / 1e6);
}

/** A pan lowers to a (quoted) ffmpeg expression; the schema's alphabet guard makes this injection-safe. */
function panExpr(pan: Pan, clipDuration: number): string {
  if (typeof pan === "number") return fmt(pan);
  if ("expr" in pan) return pan.expr;
  return `(${fmt(pan.from)}+(${fmt(pan.to)}-${fmt(pan.from)})*t/${fmt(clipDuration)})`;
}

/** crop → eq → scale, only what the clip declares. */
function clipFilters(clip: EdlClip): string[] {
  const parts: string[] = [];
  if (clip.crop) {
    const { width, height, x, y } = clip.crop;
    parts.push(
      `crop=${width}:${height}:x='${panExpr(x, clip.duration)}':y='${panExpr(y, clip.duration)}'`,
    );
  }
  if (clip.grade) {
    const eq: string[] = [];
    if (clip.grade.brightness !== undefined) eq.push(`brightness=${fmt(clip.grade.brightness)}`);
    if (clip.grade.gamma !== undefined) eq.push(`gamma=${fmt(clip.grade.gamma)}`);
    if (clip.grade.saturation !== undefined) eq.push(`saturation=${fmt(clip.grade.saturation)}`);
    if (eq.length > 0) parts.push(`eq=${eq.join(":")}`);
  }
  if (clip.scale) {
    parts.push(`scale=${clip.scale.width}:${clip.scale.height}:flags=${clip.scale.flags}`);
  }
  return parts;
}

/** The plate recipe (build-captions.sh): text → black feathered backing + amber glow → flatten. */
function plateCommands(
  style: CaptionStyle,
  text: string,
  width: number,
  height: number,
  file: string,
): string[][] {
  const scratch = "_t.png";
  return [
    [
      "-size",
      `${width}x${height}`,
      "xc:none",
      "-font",
      style.font,
      "-pointsize",
      String(style.pointsize),
      "-kerning",
      fmt(style.kerning),
      "-fill",
      style.fill,
      "-gravity",
      "center",
      "-annotate",
      "+0+0",
      text,
      scratch,
    ],
    [
      scratch,
      "(",
      "+clone",
      "-channel",
      "A",
      "-blur",
      "0x14",
      "-evaluate",
      "multiply",
      "0.5",
      "+channel",
      "-fill",
      "black",
      "-colorize",
      "100",
      ")",
      "(",
      scratch,
      "-channel",
      "A",
      "-blur",
      "0x6",
      "-evaluate",
      "multiply",
      "0.7",
      "+channel",
      "-fill",
      style.glowFill,
      "-colorize",
      "100",
      ")",
      scratch,
      "-background",
      "none",
      "-layers",
      "flatten",
      file,
    ],
  ];
}

/**
 * The music-lane lowering, shared by the encode and copy video paths:
 * stream-copy the cue's audio track, or offset + STATIC gain + entry/tail
 * easing (atrim → volume → afade in → afade out — the G-score mux chain,
 * byte-pinned by the scored-master replay).
 */
function lowerAudioCue(
  cue: AudioCue,
  inputs: PlanInput[],
  filters: string[],
  maps: string[],
  audioArgs: string[],
): void {
  const idx = inputs.length;
  inputs.push({ source: cue.source });
  if (cue.mode === "copy") {
    maps.push(`${idx}:a`);
    audioArgs.push("-c:a", "copy");
    return;
  }
  const chain: string[] = [];
  if (cue.offset > 0) chain.push(`atrim=start=${fmt(cue.offset)}`, "asetpts=PTS-STARTPTS");
  if (cue.gainDb !== 0) chain.push(`volume=${fmt(cue.gainDb)}dB`);
  if (cue.fadeIn) chain.push(`afade=t=in:st=0:d=${fmt(cue.fadeIn.duration)}`);
  if (cue.fadeOut) {
    chain.push(`afade=t=out:st=${fmt(cue.fadeOut.start)}:d=${fmt(cue.fadeOut.duration)}`);
  }
  if (chain.length > 0) {
    filters.push(`[${idx}:a]${chain.join(",")}[aout]`);
    maps.push("[aout]");
  } else {
    maps.push(`${idx}:a`);
  }
  audioArgs.push("-c:a", "aac");
  if (cue.bitrateKbps !== undefined) audioArgs.push("-b:a", `${cue.bitrateKbps}k`);
}

export function compileEdl(input: EdlInput): EdlPlan {
  const edl: Edl = edlSchema.parse(input);
  const { output } = edl;

  if (edl.audio.length > 1) {
    throw new Error("edl compiler: at most one audio cue is supported (extend additively)");
  }

  // Copy output mode (B-ve.4): the picture is stream-copied from the single
  // clip — no filtergraph touches it, no -r (frame-rate forcing and stream
  // copy don't mix), zero generation loss. The schema door already refused
  // anything a stream copy cannot honestly do.
  if (output.video.mode === "copy") {
    const inputs: PlanInput[] = [{ source: edl.video[0].source }];
    const filters: string[] = [];
    const maps: string[] = ["0:v"];
    const audioArgs: string[] = [];
    if (edl.audio.length === 1) lowerAudioCue(edl.audio[0], inputs, filters, maps, audioArgs);
    return {
      plates: [],
      inputs,
      filter: filters.join(";"),
      maps,
      audioArgs,
      videoArgs: ["-c:v", "copy"],
      duration: fmt(output.duration),
    };
  }

  const overlayIndex = edl.video.findIndex((c) => c.transitionIn?.type === "overlay-fade");
  const beats = overlayIndex === -1 ? edl.video : edl.video.slice(0, overlayIndex);
  const overlays = overlayIndex === -1 ? [] : edl.video.slice(overlayIndex);
  if (overlays.length > 1) {
    throw new Error("edl compiler: at most one overlay-fade clip is supported (extend additively)");
  }
  if (beats.length === 0) {
    throw new Error("edl compiler: the beat lane cannot start with an overlay-fade clip");
  }
  beats.forEach((clip, i) => {
    if (i === 0 && clip.transitionIn) {
      throw new Error(`edl compiler: the first clip ("${clip.name}") cannot carry a transition`);
    }
    if (i > 0 && clip.transitionIn?.type !== "xfade") {
      throw new Error(
        `edl compiler: beat "${clip.name}" must declare an xfade transition (hard cuts arrive additively)`,
      );
    }
  });
  /** Assembled beat-lane duration: sum(durations) − sum(xfade overlaps). */
  const laneDuration = beats.reduce(
    (acc, clip) => acc + clip.duration - (clip.transitionIn?.duration ?? 0),
    0,
  );

  const inputs: PlanInput[] = [];
  const filters: string[] = [];
  const plates: PlateSpec[] = [];

  // 1) Beat sources, in lane order (recipe input order).
  for (const clip of beats) {
    inputs.push(
      clip.source.kind === "still"
        ? { source: clip.source, holdFor: fmt(clip.duration) }
        : { source: clip.source },
    );
  }

  // 2) Normalize + xfade when the lane assembles; a single bare clip passes through.
  let prev: string;
  if (beats.length > 1) {
    beats.forEach((clip, i) => {
      const chain = [...clipFilters(clip), "setsar=1", `fps=${output.fps}`, "format=yuv420p"];
      filters.push(`[${i}:v]${chain.join(",")}[p${i + 1}]`);
    });
    let offset = 0;
    prev = "p1";
    beats.slice(1).forEach((clip, k) => {
      const fade = clip.transitionIn?.duration ?? 0;
      offset += beats[k].duration - fade;
      const label = `x${k + 1}`;
      filters.push(
        `[${prev}][p${k + 2}]xfade=transition=fade:duration=${fmt(fade)}:offset=${fmt(offset)}[${label}]`,
      );
      prev = label;
    });
    filters.push(`[${prev}]format=rgba[base]`);
    prev = "base";
  } else {
    const only = beats[0];
    const chain = clipFilters(only);
    if (chain.length > 0) {
      filters.push(
        `[0:v]${[...chain, "setsar=1", `fps=${output.fps}`, "format=yuv420p"].join(",")}[p1]`,
      );
      prev = "p1";
    } else {
      prev = "0:v";
    }
  }

  // 3) Caption plates: inputs loop for the assembled lane duration; overlays
  //    at center-relative offsets with alpha fade windows.
  const lines = edl.captions?.lines ?? [];
  if (edl.captions && lines.length > 0) {
    const { style } = edl.captions;
    const plateBase = inputs.length;
    lines.forEach((line, j) => {
      const file = `c${j + 1}.png`;
      plates.push({ file, commands: plateCommands(style, line.text, output.width, output.height, file) });
      inputs.push({ plate: file, holdFor: fmt(laneDuration) });
    });
    lines.forEach((line, j) => {
      const idx = plateBase + j;
      const label = `c${j + 1}`;
      filters.push(
        `[${idx}:v]format=rgba,fade=in:st=${fmt(line.fadeIn)}:d=${fmt(line.ramp)}:alpha=1,` +
          `fade=out:st=${fmt(line.fadeOut)}:d=${fmt(line.ramp)}:alpha=1[${label}]`,
      );
      filters.push(
        `[${prev}][${label}]overlay=x=${line.x - output.width / 2}:y=${line.y - output.height / 2}[v${j + 1}]`,
      );
      prev = `v${j + 1}`;
    });
  }

  // 4) The overlay-fade machinery: trim → clone-hold freeze → alpha fade-in on top.
  if (overlays.length === 1) {
    const clip = overlays[0];
    const at = clip.at as number; // schema-guaranteed for overlay-fade
    const fade = clip.transitionIn?.duration as number;
    const idx = inputs.length;
    inputs.push(
      clip.source.kind === "still"
        ? { source: clip.source, holdFor: fmt(clip.duration) }
        : { source: clip.source },
    );
    filters.push(
      `[${prev}]trim=0:${fmt(at)},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${fmt(
        output.duration - at,
      )}[frozen]`,
    );
    const chain = [...clipFilters(clip), "format=rgba", `fade=in:st=${fmt(at)}:d=${fmt(fade)}:alpha=1`];
    filters.push(`[${idx}:v]${chain.join(",")}[ecf]`);
    filters.push(`[frozen][ecf]overlay=x=0:y=0[vout]`);
    prev = "vout";
  }

  const maps: string[] = [prev === "0:v" ? "0:v" : `[${prev}]`];

  // 5) The music lane: stream-copy or offset + static gain + entry/tail easing.
  const audioArgs: string[] = [];
  if (edl.audio.length === 1) lowerAudioCue(edl.audio[0], inputs, filters, maps, audioArgs);

  return {
    plates,
    inputs,
    filter: filters.join(";"),
    maps,
    audioArgs,
    videoArgs: [
      "-c:v",
      output.video.codec,
      "-crf",
      String(output.video.crf),
      "-preset",
      output.video.preset,
      "-pix_fmt",
      output.video.pixFmt,
    ],
    fps: String(output.fps),
    duration: fmt(output.duration),
  };
}
