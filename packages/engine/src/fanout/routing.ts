import { routingTableSchema } from "@thalon/contracts";

/**
 * B7.e routing table — content bucket → platforms, per-tenant config data
 * (`brand_profiles.routing`, contracts `routingTableSchema`; frozen window-1
 * schema). Bucket names are tenant vocabulary (topics, pillars) — data,
 * never code. Pure resolution so the semantics are testable without a db
 * and never drift silently:
 *
 *  - No bucket on the request, or no routing config on the profile ⇒ the
 *    caller's platforms, untouched (absence disarms — pre-B7.e fan-outs are
 *    byte-identical).
 *  - An unrouted bucket keeps the default behavior (the caller's
 *    platforms), per the contract's docblock.
 *  - An EMPTY routing entry also falls back: suppressing a bucket is not a
 *    routing decision (fan-out requires ≥1 platform), and silently emitting
 *    nothing would read as success.
 *  - Routed platform lists are deduped; order is the caller's concern
 *    (runFanout sorts for its generation key).
 */
export interface RoutedPlatforms {
  platforms: string[];
  /** true only when a routing entry actually decided the list — run-params provenance. */
  routed: boolean;
}

export function resolveRoutedPlatforms(
  routingRaw: unknown,
  bucket: string | undefined,
  defaultPlatforms: string[],
): RoutedPlatforms {
  if (bucket === undefined || routingRaw === null || routingRaw === undefined) {
    return { platforms: defaultPlatforms, routed: false };
  }
  // Validated at the profile write door — a parse failure here is a genuine
  // invariant break and must be loud, never a silent misroute.
  const table = routingTableSchema.parse(routingRaw);
  const entry = table[bucket];
  if (entry === undefined || entry.length === 0) {
    return { platforms: defaultPlatforms, routed: false };
  }
  return { platforms: [...new Set(entry)], routed: true };
}
