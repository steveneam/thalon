import { readEnv } from "@thalon/platform";
import { blueskyTrendSource } from "./bluesky-source";
import { createFakeTrendSource } from "./fake-source";
import type { TrendSource } from "./trend-source";
import { youtubeTrendSource } from "./youtube-source";

/**
 * B6.5: the env-selected TrendSource registry the seam always promised
 * (mirrors TRANSCRIPT_PROVIDER / SEARCH_INTEL_SOURCE — drivers are config,
 * never new intake code paths):
 *
 *   fake     — deterministic keyless double (empty item set here; tests
 *              construct their own with fixture items)
 *   bluesky  — official AT Protocol public AppView, KEYLESS (the first live
 *              driver — start here)
 *   youtube  — official Data API v3, keyed (YOUTUBE_API_KEY), quota budgets
 *              as config
 *
 * Selection: explicit name > `TREND_SOURCE` env > "fake". X/Twitter API v2
 * stays the recorded when-funded swap path (B3.12) — a future keyed entry
 * behind this same seam.
 */
const SOURCE_REGISTRY: Record<string, () => TrendSource> = {
  fake: () => createFakeTrendSource([]),
  bluesky: () => blueskyTrendSource(),
  youtube: () => youtubeTrendSource(),
};

export function registeredTrendSources(): string[] {
  return Object.keys(SOURCE_REGISTRY);
}

export function getTrendSource(name?: string): TrendSource {
  const selected = name?.trim() || readEnv().TREND_SOURCE;
  const factory = SOURCE_REGISTRY[selected];
  if (!factory) {
    throw new Error(
      `unknown trend source "${selected}" — registered: ${registeredTrendSources().join(", ")} (TREND_SOURCE selects; drivers are config, never new intake code paths)`,
    );
  }
  return factory();
}
