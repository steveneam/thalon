import type { EdlInput } from "@thalon/contracts";

/**
 * The concept film's SCORED 16:9 master — the s44 G-score mux made
 * expressible (B-ve.4 `copy` output mode). The historical master
 * (`cuts/thalon-concept-film-16x9-master.mp4`) was a hand command never
 * recorded verbatim; this EDL is its recovered decision record: the v6
 * picture stream-copied untouched, the Emotional Cello track entering at
 * 105.0s (hush on the gate-lift, slam at the wing-snap — s44 round-3b),
 * level-flat through the sheet, a 1.2s anti-click entry ease (recovered
 * from the master's own waveform at the half-window — the ledger never
 * mentioned it) and the 1.275s tail ease of the founder's ending fix.
 *
 * Replays `cuts/concept-film-16x9-scored-v1.mp4` (its own EDL-built
 * output). The bridge to the historical master is pinned separately: the
 * replay's AUDIO stream is framemd5-identical to the hand mux's, while its
 * video keeps all 1219 v6 frames (the hand command dropped the last 3 — a
 * `-t` stream-copy artifact, not an editorial decision, so the EDL does not
 * reproduce it).
 */
export const film16x9Scored: EdlInput = {
  name: "concept-film-16x9-scored",
  output: {
    width: 1280,
    height: 720,
    fps: 24,
    duration: 50.775,
    video: { mode: "copy" },
  },
  video: [
    {
      name: "v6-picture",
      source: { kind: "cut", ref: "cuts/cut-v6-endcard-graded.mp4" },
      duration: 50.775,
    },
  ],
  audio: [
    {
      source: { kind: "audio", ref: "music/emotional-cello_the-mountain.mp3" },
      offset: 105,
      fadeIn: { duration: 1.2 },
      fadeOut: { start: 49.5, duration: 1.275 },
      bitrateKbps: 192,
    },
  ],
};
