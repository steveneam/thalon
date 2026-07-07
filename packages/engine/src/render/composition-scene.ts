import type { DirectionMotion } from "@thalon/contracts";
import {
  COMPOSITION_GSAP_SRC,
  MOTION_EASING,
  PACING_SECONDS,
  escapeHtml,
  hexToRgba,
  secondsLiteral,
  type CaptionWord,
  type CompositionCue,
  type CompositionSpec,
  type CueNarrationClip,
} from "./composition";
import type { MotionEvent } from "./composition-pacing";

/**
 * Composition v2's scene layer: one sub-composition per cue
 * (`data-composition-src` per scene — the B5.1 linter's own advisory),
 * planned first (pure timing math the pacing rule can measure) and emitted
 * second (deterministic string assembly). The kinetic caption component is
 * the pill-karaoke grammar re-derived as compile-time TS — word spans are
 * grouped, laid out, and timed by the GENERATOR (char-count line packing,
 * never runtime canvas measurement), so the emitted document is static
 * markup plus fixed tweens. Word timings come from the narration clip's
 * real TTS alignment when the audio seam is armed, else from the
 * deterministic char-weight estimator below. Numeric onScreenText renders
 * as a stat count-up block (the catalog's object-tween/onUpdate recipe —
 * seek-safe: GSAP replays interpolated state at any frame).
 */

/** Deterministic word-timing estimator: char-weight proportional spread across the cue window (small entry/exit pads). Used whenever no real alignment exists. */
export function estimateCaptionWords(text: string, cueDurationMs: number): CaptionWord[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const startPad = Math.min(150, Math.round(cueDurationMs * 0.1));
  const endPad = Math.min(250, Math.round(cueDurationMs * 0.15));
  const usable = Math.max(1, cueDurationMs - startPad - endPad);
  const weights = words.map((w) => w.length + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let cum = 0;
  return words.map((text_, i) => {
    const startMs = startPad + Math.round((usable * cum) / total);
    cum += weights[i];
    const endMs = startPad + Math.round((usable * cum) / total);
    return { text: text_, startMs, endMs };
  });
}

export interface CaptionGroupPlan {
  words: CaptionWord[];
  /** ≤2 lines of word indexes into `words` (char-packed, balanced). */
  lines: number[][];
  /** Visible window, cue-local ms (windows tile; the last group holds to scene end). */
  visStartMs: number;
  visEndMs: number;
}

export interface StatPlan {
  prefix: string;
  /** The matched number token verbatim (may carry commas) — also the markup's resting value. */
  numberText: string;
  suffix: string;
  target: number;
  /** Cue-local tween start/duration ms. */
  startMs: number;
  durationMs: number;
}

export interface ScenePlan {
  index: number;
  cue: CompositionCue;
  cueDurationMs: number;
  /** Cue duration + the NEXT transition's tail — the sub-composition's full mounted life. */
  localDurationMs: number;
  narration: CueNarrationClip | null;
  captionGroups: CaptionGroupPlan[];
  stat: StatPlan | null;
  /** Cue-local accent-pulse times, assigned by the project's pacing pass. */
  pulses: number[];
}

const GROUP_MAX_WORDS = 4;
const GROUP_PAUSE_MS = 350;
const GROUP_LEAD_MS = 80;
const ENTRANCE_LOCAL_MS = 120;

function captionFontPx(spec: CompositionSpec): number {
  return Math.round(Math.min(spec.width, spec.height) / 26);
}

function charsPerLine(spec: CompositionSpec): number {
  return Math.max(8, Math.floor((spec.width * 0.78) / (captionFontPx(spec) * 0.55)));
}

function joinedLength(words: CaptionWord[]): number {
  return words.reduce((a, w) => a + w.text.length, 0) + Math.max(0, words.length - 1);
}

/** Balanced ≤2-line split by char count (the pill recipe's layout planner without the canvas). */
function splitLines(words: CaptionWord[], perLine: number): number[][] {
  const all = words.map((_, i) => i);
  if (joinedLength(words) <= perLine || words.length === 1) return [all];
  let best: number[][] | null = null;
  let bestImbalance = Infinity;
  for (let split = 1; split < words.length; split++) {
    const a = words.slice(0, split);
    const b = words.slice(split);
    if (joinedLength(a) <= perLine && joinedLength(b) <= perLine) {
      const imbalance = Math.abs(joinedLength(a) - joinedLength(b));
      if (imbalance < bestImbalance) {
        best = [all.slice(0, split), all.slice(split)];
        bestImbalance = imbalance;
      }
    }
  }
  return best ?? [all.slice(0, Math.ceil(words.length / 2)), all.slice(Math.ceil(words.length / 2))];
}

/** Word stream → karaoke groups: break on punctuation, natural pauses, the word cap, or two full lines. */
export function groupCaptionWords(
  words: CaptionWord[],
  spec: CompositionSpec,
  cueDurationMs: number,
  localDurationMs: number,
): CaptionGroupPlan[] {
  const perLine = charsPerLine(spec);
  const maxGroupChars = perLine * 2;
  const rawGroups: CaptionWord[][] = [];
  let current: CaptionWord[] = [];
  words.forEach((word, i) => {
    if (current.length >= GROUP_MAX_WORDS || (current.length > 0 && joinedLength([...current, word]) > maxGroupChars)) {
      rawGroups.push(current);
      current = [];
    }
    current.push(word);
    const next = words[i + 1];
    const punctuated = /[,.:;!?]$/.test(word.text);
    const paused = next !== undefined && next.startMs - word.endMs >= GROUP_PAUSE_MS;
    if (punctuated || paused) {
      rawGroups.push(current);
      current = [];
    }
  });
  if (current.length > 0) rawGroups.push(current);

  const groups: CaptionGroupPlan[] = [];
  for (const groupWords of rawGroups) {
    const prevEnd = groups.length > 0 ? groups[groups.length - 1].visEndMs : 0;
    const visStartMs = Math.max(prevEnd, Math.max(0, groupWords[0].startMs - GROUP_LEAD_MS));
    groups.push({
      words: groupWords,
      lines: splitLines(groupWords, perLine),
      visStartMs,
      visEndMs: localDurationMs, // provisional; tiled below
    });
  }
  groups.forEach((group, g) => {
    group.visEndMs = g < groups.length - 1 ? groups[g + 1].visStartMs : localDurationMs;
  });
  void cueDurationMs;
  return groups;
}

const STAT_PATTERN = /^(.*?)(\d{1,3}(?:,\d{3})+|\d+)(.*)$/s;

/** First integer token (comma groups allowed) in the onScreenText becomes a count-up; no number, no stat block. */
export function planStat(cue: CompositionCue, cueDurationMs: number): StatPlan | null {
  if (!cue.onScreenText) return null;
  const match = STAT_PATTERN.exec(cue.onScreenText);
  if (!match) return null;
  const target = Number(match[2].replace(/,/g, ""));
  if (!Number.isSafeInteger(target)) return null;
  return {
    prefix: match[1],
    numberText: match[2],
    suffix: match[3],
    target,
    startMs: ENTRANCE_LOCAL_MS,
    durationMs: Math.min(1_200, Math.max(600, Math.round(cueDurationMs * 0.4))),
  };
}

export function planScene(
  spec: CompositionSpec,
  cue: CompositionCue,
  index: number,
  tailMs: number,
  narration: CueNarrationClip | null,
): ScenePlan {
  const cueDurationMs = cue.endMs - cue.startMs;
  const localDurationMs = cueDurationMs + tailMs;
  const words =
    narration && narration.words.length > 0
      ? narration.words.map((w) => ({
          text: w.text,
          startMs: Math.max(0, Math.min(cueDurationMs, w.startMs)),
          endMs: Math.max(0, Math.min(cueDurationMs, w.endMs)),
        }))
      : estimateCaptionWords(cue.text, cueDurationMs);
  return {
    index,
    cue,
    cueDurationMs,
    localDurationMs,
    narration,
    captionGroups: groupCaptionWords(words, spec, cueDurationMs, localDurationMs),
    stat: planStat(cue, cueDurationMs),
    pulses: [],
  };
}

/** The scene's contribution to the pacing schedule, in ABSOLUTE composition ms (pulses excluded — they are the pacing pass's output, not its input). */
export function sceneMotionEvents(plan: ScenePlan): MotionEvent[] {
  const at = (localMs: number) => plan.cue.startMs + Math.min(localMs, plan.localDurationMs);
  const events: MotionEvent[] = [{ atMs: at(ENTRANCE_LOCAL_MS), kind: "scene-entrance", cueIndex: plan.index }];
  plan.captionGroups.forEach((group, g) => {
    if (g > 0) events.push({ atMs: at(group.visStartMs), kind: "caption-group", cueIndex: plan.index });
    group.words.forEach((word, k) => {
      if (k === 0) return; // activates with the group swap
      events.push({ atMs: at(Math.max(group.visStartMs, word.startMs)), kind: "caption-word", cueIndex: plan.index });
    });
  });
  if (plan.stat) {
    events.push({ atMs: at(plan.stat.startMs), kind: "stat-count", cueIndex: plan.index });
    events.push({ atMs: at(plan.stat.startMs + plan.stat.durationMs), kind: "stat-count", cueIndex: plan.index });
  }
  return events;
}

/** Entrance from-vars per motion enum — the easing map stays the single source of the curve; these add the shape. */
const MOTION_ENTRANCE_FROM: Record<DirectionMotion, string> = {
  smooth: "{ opacity: 0, y: 28 }",
  snappy: "{ opacity: 0, y: 36, scale: 0.97 }",
  bouncy: "{ opacity: 0, scale: 0.85 }",
  dramatic: "{ opacity: 0, scale: 1.08 }",
};

export function sceneCompositionId(index: number): string {
  return `scene-${index}`;
}

export function sceneFileName(index: number): string {
  return `compositions/scene-${index}.html`;
}

/** ScenePlan → the complete sub-composition document (transparent stage over the root's depth layer; one paused timeline registered under the scene id). */
export function emitSceneFile(spec: CompositionSpec, plan: ScenePlan): string {
  const { cue, index } = plan;
  const id = sceneCompositionId(index);
  const localSec = secondsLiteral(plan.localDurationMs);
  const paceSec = PACING_SECONDS[spec.pacing];
  const capFont = captionFontPx(spec);
  const featureFont = Math.round(Math.min(spec.width, spec.height) / 14);
  const kickerFont = Math.round(Math.min(spec.width, spec.height) / 34);
  const inactive = hexToRgba(spec.brand.textColor, 0.4);

  const featureHtml = (() => {
    if (!cue.onScreenText) return null;
    if (plan.stat) {
      const parts: string[] = [];
      if (plan.stat.prefix) parts.push(`<span>${escapeHtml(plan.stat.prefix)}</span>`);
      parts.push(`<span id="statnum">${escapeHtml(plan.stat.numberText)}</span>`);
      if (plan.stat.suffix) parts.push(`<span>${escapeHtml(plan.stat.suffix)}</span>`);
      return parts.join("");
    }
    return escapeHtml(cue.onScreenText);
  })();

  const groupsHtml = plan.captionGroups
    .map((group, g) => {
      const lines = group.lines
        .map(
          (line) =>
            `          <div class="cap-line">${line
              .map((k) => `<span id="w${g}-${k}" class="cw">${escapeHtml(group.words[k].text)}</span>`)
              .join("")}</div>`,
        )
        .join("\n");
      return `        <div id="g${g}" class="cap-group">\n${lines}\n        </div>`;
    })
    .join("\n");

  const tl: string[] = [];
  if (cue.heading) {
    tl.push(
      `      tl.fromTo("#kicker", { opacity: 0, y: -18 }, { opacity: 1, y: 0, duration: ${paceSec}, ease: "power2.out" }, 0.05);`,
    );
  }
  if (featureHtml !== null) {
    tl.push(
      `      tl.fromTo("#feature", ${MOTION_ENTRANCE_FROM[cue.motion]}, { opacity: 1, y: 0, scale: 1, duration: ${paceSec}, ease: "${MOTION_EASING[cue.motion]}" }, ${secondsLiteral(ENTRANCE_LOCAL_MS)});`,
    );
  }
  if (plan.captionGroups.length > 0) {
    tl.push(
      `      tl.fromTo("#captions", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: ${paceSec}, ease: "power2.out" }, 0.15);`,
    );
  }
  plan.captionGroups.forEach((group, g) => {
    const showSec = secondsLiteral(group.visStartMs);
    tl.push(`      tl.set("#g${g}", { opacity: 1 }, ${showSec});`);
    if (g < plan.captionGroups.length - 1) {
      tl.push(`      tl.set("#g${g}", { opacity: 0 }, ${secondsLiteral(group.visEndMs)});`);
    }
    group.words.forEach((word, k) => {
      if (k === 0) {
        tl.push(`      tl.set("#w${g}-${k}", { color: "${spec.brand.textColor}" }, ${showSec});`);
        return;
      }
      const atMs = Math.max(group.visStartMs, word.startMs);
      tl.push(
        `      tl.to("#w${g}-${k}", { color: "${spec.brand.textColor}", duration: 0.12, ease: "none" }, ${secondsLiteral(atMs)});`,
      );
    });
  });
  if (plan.stat) {
    const startSec = secondsLiteral(plan.stat.startMs);
    const durSec = secondsLiteral(plan.stat.durationMs);
    const landSec = secondsLiteral(plan.stat.startMs + plan.stat.durationMs);
    tl.push(`      var statv = { v: 0 };`);
    tl.push(
      `      tl.to(statv, { v: ${plan.stat.target}, duration: ${durSec}, ease: "power2.out", onUpdate: function () { document.getElementById("statnum").textContent = fmtInt(Math.round(statv.v)); } }, ${startSec});`,
    );
    tl.push(`      tl.to("#feature", { scale: 1.05, duration: 0.16, ease: "back.out(2.2)" }, ${landSec});`);
    tl.push(
      `      tl.to("#feature", { scale: 1, duration: 0.22, ease: "power2.out" }, ${secondsLiteral(plan.stat.startMs + plan.stat.durationMs + 160)});`,
    );
  }
  const pulseTarget = featureHtml !== null ? "#feature" : "#captions";
  for (const pulseMs of plan.pulses) {
    tl.push(
      `      tl.to("${pulseTarget}", { scale: 1.03, duration: 0.18, ease: "power2.inOut", yoyo: true, repeat: 1 }, ${secondsLiteral(pulseMs)});`,
    );
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${spec.width}, height=${spec.height}" />
    <title>${escapeHtml(`Scene ${index + 1}`)}</title>
    <script src="${COMPOSITION_GSAP_SRC}"></script>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html,
      body {
        width: ${spec.width}px;
        height: ${spec.height}px;
        overflow: hidden;
        background: transparent;
      }
      body {
        font-family: "${spec.brand.fontFamily}", sans-serif;
        color: ${spec.brand.textColor};
      }
      .scene-frame {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: ${Math.round(spec.height / 12)}px ${Math.round(spec.width / 10)}px;
        gap: ${Math.round(Math.min(spec.width, spec.height) / 36)}px;
      }
      #kicker {
        font-size: ${kickerFont}px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        opacity: 0;
        color: ${hexToRgba(spec.brand.textColor, 0.7)};
      }
      #feature {
        font-size: ${featureFont}px;
        font-weight: 700;
        color: ${spec.brand.accentColor};
        opacity: 0;
        line-height: 1.1;
        max-width: ${Math.round(spec.width * 0.84)}px;
      }
      #captions {
        opacity: 0;
        position: relative;
        width: ${Math.round(spec.width * 0.8)}px;
        min-height: ${Math.round(capFont * 3)}px;
      }
      .cap-group {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        gap: ${Math.round(capFont * 0.25)}px;
        opacity: 0;
      }
      .cap-line {
        display: flex;
        justify-content: center;
        gap: 0.35em;
        font-size: ${capFont}px;
        font-weight: 600;
        line-height: 1.3;
        white-space: nowrap;
      }
      .cw {
        color: ${inactive};
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="${id}"
      data-start="0"
      data-duration="${localSec}"
      data-width="${spec.width}"
      data-height="${spec.height}"
    >
      <div class="scene-frame">
${cue.heading ? `        <div id="kicker">${escapeHtml(cue.heading)}</div>\n` : ""}${featureHtml !== null ? `        <div id="feature">${featureHtml}</div>\n` : ""}      <div id="captions">
${groupsHtml}
      </div>
      </div>
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });
${plan.stat ? `      function fmtInt(n) { var s = String(n); return s.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ","); }\n` : ""}${tl.join("\n")}
      tl.set({}, {}, ${localSec});
      window.__timelines["${id}"] = tl;
    </script>
  </body>
</html>
`;
}
