import type { EdlInput } from "@thalon/contracts";

/**
 * The concept film's 9:16 master, transcribed from the hand recipe
 * (`build-9x16.sh`, s45 — the own-engine recut, 0cr): per-beat 405×720
 * full-height crops recomposed for the vertical frame (static, linear pan,
 * or the b9 full-width sweep expression), v1 night grade (b4 warm interior
 * untouched), the same cadence and endcard machinery as 16:9, captions
 * re-placed for the phone-safe zones, and the G score stream-copied from
 * the 16:9 master (identical timeline). Replays
 * `cuts/thalon-concept-film-9x16-master.mp4`.
 *
 * Pan targets were MEASURED from gridded source frames (s45 lesson —
 * contact-tile estimates were wrong twice, b8/b9).
 */

const GRADE = { brightness: 0.05, gamma: 1.2, saturation: 1.05 };
const SCALE = { width: 1080, height: 1920, flags: "lanczos" as const };
const XFADE = { type: "xfade" as const, duration: 0.4 };
const BEAT = 5.041667;

function beat(
  name: string,
  ref: string,
  x: number | { from: number; to: number } | { expr: string },
  opts: { grade?: boolean; first?: boolean } = {},
) {
  return {
    name,
    source: { kind: "take" as const, ref: `motion/keepers/${ref}` },
    duration: BEAT,
    crop: { width: 405, height: 720, x, y: 0 },
    ...(opts.grade === false ? {} : { grade: GRADE }),
    scale: SCALE,
    ...(opts.first ? {} : { transitionIn: XFADE }),
  };
}

export const film9x16Master: EdlInput = {
  name: "concept-film-9x16-master",
  output: { width: 1080, height: 1920, fps: 24, duration: 50.775 },
  video: [
    beat("b1-the-watch", "composite-01-the-watch-s43.mp4", 690, { first: true }),
    beat("b2-the-catch", "clip-02-the-catch.mp4", 178),
    beat("b3-the-carry", "clip-03-the-catch-s43.mp4", { from: 228, to: 678 }),
    beat("b4-the-desk", "clip-04-the-desk-s43-t2.mp4", 358, { grade: false }),
    beat("b5-fan-out", "clip-05-fan-out-s43.mp4", { from: 172, to: 388 }),
    beat("b6-mill-gate", "clip-06-the-mill-gate-s43.mp4", 495),
    beat("b7-the-seal", "clip-07-the-seal-t2.mp4", 428),
    beat("b8-release", "clip-08-release.mp4", { from: 363, to: 620 }),
    // The full-width sweep: source camera is static, six towers at fixed x,
    // flames blooming blue-first / scarlet-last — the sweep completes by
    // t=4.5 so the scarlet tower holds as it ignites before the 41.375 trim.
    beat("b9-the-bloom", "clip-09-the-bloom-s43-t2.mp4", { expr: "min(875*t/4.5,875)" }),
    {
      // Native-2K vertical window of the endcard-v2 still: mill drawing
      // above, title block below — the sharpest frame in the film.
      name: "endcard-v2-2k-window",
      source: { kind: "still", ref: "stills/keepers/beat-10-the-sheet-endcard-v2.png" },
      duration: 50.775,
      at: 41.375,
      crop: { width: 864, height: 1536, x: 1503, y: 0 },
      scale: SCALE,
      transitionIn: { type: "overlay-fade", duration: 0.4 },
    },
  ],
  // The 16:9 master's G-score track, stream-copied — identical timeline.
  audio: [
    {
      source: { kind: "cut", ref: "cuts/thalon-concept-film-16x9-master.mp4" },
      mode: "copy",
    },
  ],
  captions: {
    style: {
      font: "FreeSerif-Italic",
      pointsize: 40,
      kerning: 2,
      fill: "#eaaa40",
      glowFill: "#e09b30",
    },
    lines: [
      { text: "always watching", x: 540, y: 1560, fadeIn: 0.9, fadeOut: 4.0 },
      { text: "intel finds it", x: 540, y: 520, fadeIn: 5.341667, fadeOut: 8.641667 },
      { text: "carried home", x: 540, y: 1560, fadeIn: 9.983334, fadeOut: 13.283334 },
      { text: "drafts take shape", x: 540, y: 300, fadeIn: 14.625001, fadeOut: 17.925001 },
      { text: "posts · videos · pages", x: 540, y: 1560, fadeIn: 19.266668, fadeOut: 22.566668 },
      { text: "the judge holds one back", x: 540, y: 300, fadeIn: 23.908335, fadeOut: 27.208335 },
      { text: "you hold the seal", x: 540, y: 1620, fadeIn: 28.550002, fadeOut: 31.850002 },
      { text: "you release it", x: 540, y: 300, fadeIn: 33.191669, fadeOut: 36.491669 },
      { text: "everywhere", x: 540, y: 1560, fadeIn: 37.833336, fadeOut: 41.133336 },
    ],
  },
};
