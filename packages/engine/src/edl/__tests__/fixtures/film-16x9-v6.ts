import type { EdlInput } from "@thalon/contracts";

/**
 * The concept film's 16:9 v6 pass, transcribed from the hand recipe
 * (`build-captions.sh`, s44): the in-world caption layer + the endcard-v2
 * overlay-fade over the graded pair of record. Replays
 * `cuts/cut-v6-endcard-graded.mp4` — the video stream of the 16:9 master.
 *
 * Caption cadence: beat k starts at S=(k−1)·4.641667; fade-in max(S+0.7,
 * 0.9), fade-out S+4.0, 0.4s ramps — the values below are those numbers as
 * the recipe computed them. Placement dodges each beat's focal object (b4
 * top-left wall, b6 top deck, b8 top sky, b9 left bank); beat 10 has no
 * caption — the minted title block IS the caption.
 */
export const film16x9V6: EdlInput = {
  name: "concept-film-16x9-v6",
  output: { width: 1280, height: 720, fps: 24, duration: 50.775 },
  video: [
    {
      name: "graded-pair-of-record",
      source: { kind: "cut", ref: "cuts/rough-cut-v3-graded.mp4" },
      duration: 45.775,
    },
    {
      // The v6 endcard machinery: the timeline is trimmed at the beat-9/10
      // crossfade start and frozen; the endcard fades in on top and holds.
      name: "endcard-v2",
      source: { kind: "still", ref: "stills/keepers/beat-10-the-sheet-endcard-v2.png" },
      duration: 50.775,
      at: 41.375,
      scale: { width: 1280, height: 720, flags: "lanczos" },
      transitionIn: { type: "overlay-fade", duration: 0.4 },
    },
  ],
  audio: [],
  captions: {
    style: {
      font: "FreeSerif-Italic",
      pointsize: 44,
      kerning: 2,
      fill: "#eaaa40",
      glowFill: "#e09b30",
    },
    lines: [
      { text: "always watching", x: 640, y: 622, fadeIn: 0.9, fadeOut: 4.0 },
      { text: "intel finds it", x: 640, y: 622, fadeIn: 5.341667, fadeOut: 8.641667 },
      { text: "carried home", x: 640, y: 622, fadeIn: 9.983334, fadeOut: 13.283334 },
      { text: "drafts take shape", x: 250, y: 46, fadeIn: 14.625001, fadeOut: 17.925001 },
      { text: "posts · videos · pages", x: 640, y: 622, fadeIn: 19.266668, fadeOut: 22.566668 },
      { text: "the judge holds one back", x: 640, y: 84, fadeIn: 23.908335, fadeOut: 27.208335 },
      { text: "you hold the seal", x: 640, y: 622, fadeIn: 28.550002, fadeOut: 31.850002 },
      { text: "you release it", x: 640, y: 55, fadeIn: 33.191669, fadeOut: 36.491669 },
      { text: "everywhere", x: 240, y: 640, fadeIn: 37.833336, fadeOut: 41.133336 },
    ],
  },
};
