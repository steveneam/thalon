import { readEnv, type ThalonEnv } from "@thalon/platform";
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
 *
 * B-int.3: credential resolution went vault-first — pass a merged env VIEW
 * (integrations `vaultIntelEnvView`) and the keyed drivers read their
 * credential seats from IT (env wins where set, the tenant's connected
 * vault credential fills the silence). No view = the B6.5 behavior: the
 * drivers default their seats from the process env choke point. Selection
 * stays box config either way — only credential material is tenant data.
 */

export interface TrendSourceDeps {
  /** Injectable fetch for the keyed drivers (tests) — defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

const SOURCE_REGISTRY: Record<string, (env?: ThalonEnv, deps?: TrendSourceDeps) => TrendSource> = {
  fake: () => createFakeTrendSource([]),
  bluesky: (env, deps) =>
    blueskyTrendSource({
      fetchImpl: deps?.fetchImpl,
      config: env
        ? { identifier: env.BLUESKY_IDENTIFIER, appPassword: env.BLUESKY_APP_PASSWORD }
        : undefined,
    }),
  youtube: (env, deps) =>
    youtubeTrendSource({
      fetchImpl: deps?.fetchImpl,
      config: env ? { apiKey: env.YOUTUBE_API_KEY } : undefined,
    }),
};

export function registeredTrendSources(): string[] {
  return Object.keys(SOURCE_REGISTRY);
}

export function getTrendSource(
  name?: string,
  env?: ThalonEnv,
  deps?: TrendSourceDeps,
): TrendSource {
  const selected = name?.trim() || (env ?? readEnv()).TREND_SOURCE;
  const factory = SOURCE_REGISTRY[selected];
  if (!factory) {
    throw new Error(
      `unknown trend source "${selected}" — registered: ${registeredTrendSources().join(", ")} (TREND_SOURCE selects; drivers are config, never new intake code paths)`,
    );
  }
  return factory(env, deps);
}
