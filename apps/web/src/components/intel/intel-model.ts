import type { CreateFamily } from "@/lib/intel/types";

/**
 * The view model the Intel sheet draws (Intel.dc.html). Every field here is
 * something the sheet renders literally, so the port stays a port: step 1
 * feeds these shapes the sheet's own placeholder content, step 2 maps real
 * `TrendCard` rows onto the same shapes. Nothing in the markup formats data
 * — the formatting lives here, unit-tested beside the surface.
 */

/** One row of the "Why it's moving" band — [name | magnitude bar | text]. */
export interface ReasonView {
  /** "Velocity 0.92" — the ranker's signal name, capitalized, with its score. */
  name: string;
  /** Bar width, 0–100. */
  percent: number;
  /** The bar's thermal fill, e.g. "var(--heat-hot)". */
  heat: string;
  /** The readable half of the reason. */
  text: string;
  /** The full reason string, verbatim from the ranker (hover truth). */
  title: string;
}

/** The expanded dossier card — one card at a time, the sheet's launchpad. */
export interface DossierView {
  id: string;
  /** Thermal word-in-pill: the word IS the text channel, never colour alone. */
  band: { word: string; pill: string; fill: string };
  /** Rank magnitude 0–100 + the exact score in the hover title. */
  percent: number;
  scoreTitle: string;
  isOutlier: boolean;
  /** "rising 3h · catchable" — only rising/hot cards earn it. */
  freshness: string | null;
  headline: string;
  prov: {
    account: string;
    /** "24.6k views" — absent when the source reports no view count. */
    views: string | null;
    age: string;
    sourceLabel: string;
    url?: string;
    areaName: string;
  };
  /** A real platform thumbnail when the driver captured one; never synthesized. */
  thumbnailUrl?: string;
  /** The sheet's placeholder legend inside the striped thumb. */
  thumbLabel: string;
  reasons: ReasonView[];
  titles: string[];
  angles: string[];
  hook: string | null;
  /** The pre-picked exit: word + primary weight, a default and never a gate. */
  suggested: { family: CreateFamily; label: string; reason: string };
}

/** One compact row of the "More rising" card. */
export interface RisingView {
  id: string;
  band: { word: string; pill: string };
  thumbnailUrl?: string;
  thumbLabel: string;
  text: string;
  /** "YouTube · 12.1k · 5h ago" — the row's mono data stamp. */
  data: string;
  url?: string;
}

/** A watch chip — a monitored area as the sheet draws it. */
export interface WatchView {
  id: string;
  name: string;
  description: string;
  paused: boolean;
}
