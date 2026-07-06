import { cn } from "@/lib/utils";

/**
 * Heat grading for intel rank scores (founder direction 2026-07-07, refined
 * same day: "hot is red, warm is yellow, stale is blue — make it obvious").
 * A THERMAL scale worn as a filled pill:
 *   1. the pill COLOUR is the glance (stale-blue → yellow → orange → red —
 *      the universal temperature convention, distinct from the reserved
 *      status palette: hot sits hue-side of --destructive),
 *   2. the band WORD inside the pill is the text channel — identity is
 *      never colour-alone, and it's the direct label that relieves the
 *      light yellow/orange fills (all in-pill text pairs clear WCAG AA,
 *      adjacent-band CVD ΔE ≥ 13, validated at design time),
 *   3. a small magnitude bar keeps within-band nuance (0.82 vs 0.97 both
 *      read "hot"; the bar says which is hotter),
 *   4. the exact score demotes to the tooltip/aria — available, not shouted.
 */

export type HeatBand = "cool" | "warm" | "rising" | "hot";

const BANDS: Array<{ band: HeatBand; min: number; fill: string; pill: string }> = [
  { band: "hot", min: 0.8, fill: "bg-heat-4", pill: "bg-heat-4 text-heat-paper" },
  { band: "rising", min: 0.6, fill: "bg-heat-3", pill: "bg-heat-3 text-heat-ink" },
  { band: "warm", min: 0.4, fill: "bg-heat-2", pill: "bg-heat-2 text-heat-ink" },
  { band: "cool", min: 0, fill: "bg-heat-1", pill: "bg-heat-1 text-heat-paper" },
];

export function heatBand(score: number): HeatBand {
  return BANDS.find(({ min }) => score >= min)?.band ?? "cool";
}

/** The glanceable read: thermal pill + magnitude bar; exact score in the tooltip. */
export function HeatGrade({ score, className }: { score: number; className?: string }) {
  const clamped = Math.min(1, Math.max(0, score));
  const { band, fill, pill } = BANDS.find(({ min }) => clamped >= min) ?? BANDS[BANDS.length - 1];
  return (
    <span
      role="img"
      aria-label={`heat ${band} — rank score ${clamped.toFixed(2)} of 1`}
      title={`rank score ${clamped.toFixed(2)} (0–1) for this area`}
      className={cn("inline-flex items-center gap-1.5 align-middle", className)}
    >
      <span
        aria-hidden
        className={cn(
          "u-eyebrow inline-flex items-center rounded-full border border-black/10 px-2 py-0.5",
          pill,
        )}
      >
        {band}
      </span>
      <span aria-hidden className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
        <span
          data-heat-bar
          className={cn("block h-full rounded-full", fill)}
          style={{ width: `${clamped * 100}%` }}
        />
      </span>
    </span>
  );
}
