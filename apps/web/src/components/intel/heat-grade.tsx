/**
 * Heat BANDING for intel rank scores (founder direction 2026-07-07, refined
 * same day: "hot is red, warm is yellow, stale is blue — make it obvious").
 * The thresholds are the shared truth: board cards, Create's picks and the
 * lead score bar all band through `heatBand`.
 *
 * The rendering that used to live here — a Tailwind-class thermal pill plus a
 * magnitude bar — was REMOVED in s76 (founder: worth including, or not?). It
 * was superseded, not lost: the exact-mock rebuild gave Intel the sheet's own
 * thermal grammar (`pill pill-heat-*`, word-in-pill) in `rising-card.tsx` and
 * `dossier-card.tsx`, and after the legacy leads board went the component had
 * no caller. Two implementations of one visual language is the drift the
 * rebuild exists to end. The band boundaries stay pinned by their test.
 */

export type HeatBand = "cool" | "warm" | "rising" | "hot";

const BANDS: Array<{ band: HeatBand; min: number }> = [
  { band: "hot", min: 0.8 },
  { band: "rising", min: 0.6 },
  { band: "warm", min: 0.4 },
  { band: "cool", min: 0 },
];

export function heatBand(score: number): HeatBand {
  return BANDS.find(({ min }) => score >= min)?.band ?? "cool";
}
