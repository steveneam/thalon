import type { SocialPlatform } from "@thalon/contracts";

/**
 * STANDING METRICS DEFERRALS — platforms whose readers are BUILT and WORK,
 * and which we deliberately do not read, on cost. This file is the seat of
 * the founder's ruling, and it is code rather than config ON PURPOSE: a
 * tenant toggle or an env key would make a product-wide cost ruling
 * accidentally liftable, and the whole point of `deferred` as its own
 * absence word is that lifting it is a deliberate founder act.
 *
 * **Lifting a deferral = deleting its entry from this map** — a small,
 * founder-visible diff in a file that exists for exactly that, plus the
 * tests that pin the entry (they name themselves when they fail).
 *
 * This is deliberately NOT a row in `capability.ts`: the matrix holds
 * doc-verified facts about what a platform CAN report, and a deferral is
 * (in errors.ts's own words) "not a capability fact about the platform at
 * all — a standing founder decision about when we start paying". The
 * enforcement seat is `resolveSocialMetricsReader` (registry.ts), which
 * consults this map before anything else — before the capability row, and
 * before the credential — so a deferred platform refuses with the ruling,
 * never with a credential complaint, on every road a production resolution
 * can take.
 */
export const STANDING_METRICS_DEFERRALS: Readonly<Partial<Record<SocialPlatform, string>>> = {
  /**
   * FOUNDER RULING, 2026-07-29 (s87). The reader (`x-v2-public-metrics`)
   * is built and passing tests; X's API bills per resource read, and the
   * founder deferred paying that bill until launch.
   */
  x:
    'deferred until launch by founder ruling (2026-07-29, s87): "X analytics and posting bill ' +
    'will only be paid once thalon is ready to launch, so towards the end." The reader is built ' +
    'and works — this is "we won\'t yet", not "we can\'t" — and X reads are billed per resource, ' +
    "which is exactly the bill the ruling defers.",
};

/** The one lookup every consumer shares — the ratchet, the tick's bill print, and the read-model's cells. */
export function standingMetricsDeferral(platform: SocialPlatform): string | undefined {
  return STANDING_METRICS_DEFERRALS[platform];
}
