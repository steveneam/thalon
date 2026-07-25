import type { CreateFamily, TrendCard } from "@/lib/intel/types";
import { heatBand } from "@/components/intel/heat-grade";

/**
 * Launchpad helpers for the Intel dossier (Phase D design #4). Pure and
 * presentation-side on purpose: the promote contract is frozen, so the
 * "suggested" exit is a UI default the operator can ignore — never a gate,
 * never persisted.
 */

/** Sources whose items are video-native — a clip meets them in kind. */
const VIDEO_NATIVE_SOURCES = new Set(["youtube", "tiktok"]);

/**
 * The family heuristic behind the "suggested" exit emphasis (design #4:
 * one exit wears a heavier border + the word — a default, not a gate; all
 * three exits stay one click). Deterministic by source shape; the reason
 * string is the tooltip so the pre-pick explains itself.
 */
export function suggestedExit(card: TrendCard): { family: CreateFamily; reason: string } {
  if (VIDEO_NATIVE_SOURCES.has(card.source)) {
    return { family: "video", reason: "pre-picked: video-native source — a clip meets it in kind" };
  }
  return { family: "post", reason: "pre-picked: thread-shaped topics compose best as posts" };
}

/**
 * Compact count for provenance/meta rows — the mock sheet's own number
 * grammar ("24.6k views", "12.1k", "1.2M"): ONE decimal at every magnitude,
 * dropped when it is zero. (It used to round whole above 10k, which wrote
 * "25k" where the sheet writes "24.6k".) Tabular surfaces keep exact numbers.
 */
export function compactCount(n: number): string {
  for (const { value, suffix } of [
    { value: 1_000_000, suffix: "M" },
    { value: 1_000, suffix: "k" },
  ]) {
    if (n >= value) {
      return `${Math.round((n / value) * 10) / 10}${suffix}`;
    }
  }
  return String(n);
}

/**
 * The honest loss-framing stamp (ux-v2 §5.5: velocity is genuinely
 * perishable, so "rising 19h · catchable" is truthful — fake urgency is
 * not). Only rising/hot cards earn it; cooler bands say nothing extra.
 */
export function freshnessStamp(card: TrendCard, now: number = Date.now()): string | null {
  const band = heatBand(card.score);
  if (band !== "rising" && band !== "hot") return null;
  const hours = Math.max(1, Math.floor((now - new Date(card.publishedAt).getTime()) / 3_600_000));
  const age = hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
  return `rising ${age} · catchable`;
}
