import type { EdlInput } from "@thalon/contracts";

/**
 * The measured music-placement verb in encode mode (the s44 method, plan
 * coverage only — the film masters cover copy mode): score enters at a
 * measured offset, STATIC gain (level-flat = no filter at all), and the
 * anti-click tail easing is the only fade — a fade is for avoiding clicks,
 * not for manufacturing an ending (founder, s44 FINAL).
 */
export const musicCue: EdlInput = {
  name: "music-cue-demo",
  output: { width: 1280, height: 720, fps: 24, duration: 50.775 },
  video: [
    {
      name: "picture-lock",
      source: { kind: "cut", ref: "cuts/cut-v6-endcard-graded.mp4" },
      duration: 50.775,
    },
  ],
  audio: [
    {
      source: { kind: "audio", ref: "audio/score-candidate.m4a" },
      offset: 105,
      gainDb: 0,
      fadeOut: { start: 49.5, duration: 1.275 },
      mode: "encode",
    },
  ],
};
