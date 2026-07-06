import { cn } from "@/lib/utils";

/**
 * Heat grading for intel rank scores (founder direction 2026-07-07: a
 * glanceable temperature read, not a bare number). Design per the dataviz
 * method — the score's job is MAGNITUDE, so:
 *   1. bar LENGTH is the primary encoding (survives every colour vision),
 *   2. the grade WORD is the text channel (never colour-alone),
 *   3. a SEQUENTIAL amber ramp (one hue light→dark, hot = --signal) is the
 *      redundant colour channel — deliberately NOT a traffic-light ramp,
 *      which would collide with the reserved status colours and read as
 *      good/bad instead of cool/hot.
 * The exact score demotes to the tooltip/aria — available, not shouted.
 */

export type HeatBand = "cool" | "warm" | "rising" | "hot";

const BANDS: Array<{ band: HeatBand; min: number; fill: string }> = [
  { band: "hot", min: 0.8, fill: "bg-heat-4" },
  { band: "rising", min: 0.6, fill: "bg-heat-3" },
  { band: "warm", min: 0.4, fill: "bg-heat-2" },
  { band: "cool", min: 0, fill: "bg-heat-1" },
];

export function heatBand(score: number): HeatBand {
  return BANDS.find(({ min }) => score >= min)?.band ?? "cool";
}

/** The glanceable read: magnitude bar + grade word; exact score in the tooltip. */
export function HeatGrade({ score, className }: { score: number; className?: string }) {
  const clamped = Math.min(1, Math.max(0, score));
  const { band, fill } = BANDS.find(({ min }) => clamped >= min) ?? BANDS[BANDS.length - 1];
  return (
    <span
      role="img"
      aria-label={`heat ${band} — rank score ${clamped.toFixed(2)} of 1`}
      title={`rank score ${clamped.toFixed(2)} (0–1) for this area`}
      className={cn("inline-flex items-center gap-1.5 align-middle", className)}
    >
      <span aria-hidden className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", fill)} style={{ width: `${clamped * 100}%` }} />
      </span>
      <span aria-hidden className="u-eyebrow text-signal">
        {band}
      </span>
    </span>
  );
}
