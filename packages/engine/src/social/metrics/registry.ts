import type { SocialPlatform } from "@thalon/contracts";
import type { EnvSource } from "@thalon/platform";
import { socialArmKeys } from "../registry";
import {
  metricCapability,
  type MetricLabel,
  type PlatformMetricCapability,
} from "./capability";
import { SocialMetricsGatedError, SocialMetricsUnavailableError, type SocialMetricsRefusedError } from "./errors";

/**
 * D2 (s87): the METRICS READER seam — a sibling of `../registry.ts`, not an
 * extension of it. The lane's reported seam decision, in code:
 *
 *   1. **A reader cannot post.** `SocialMetricsReader` has no `publish`.
 *      The collection tick holds only readers, so no bug in it can reach a
 *      platform's write path — the queue consumer's "structurally, not just
 *      by flag" posture applied to the read side.
 *   2. **Reading needs a credential, not the posting GO.** The ratchet below
 *      is `resolveSocialPublisher`'s minus the `SOCIAL_<P>_ARMED` seat.
 *      Measuring posts we ALREADY published is not an outbound act, and
 *      making it need the posting arm would mean disarming a platform
 *      silently stops measuring everything it ever carried.
 *   3. **Its refusals are its own** (./errors.ts) — permission and platform
 *      capability, never arming and fit.
 *
 * Like the publisher seam it has NO network-reaching default: the production
 * map is assembled in ../drivers/index.ts and passed in, and tests inject the
 * fake. An unwired resolver reaches nothing at all.
 */

/** What the reader needs to identify one post — everything from the ledger row, nothing derived. */
export interface PostMetricsRequest {
  /** The platform's own accepted-post id, verbatim (`social_publications.external_post_id`). */
  externalPostId: string;
  /**
   * The publication's `meta`, verbatim — where a driver finds what it
   * recorded at publish time (Facebook's `pageId`, Bluesky's `cid`). Read
   * defensively: a row written by an older driver may not carry it.
   */
  meta?: Record<string, unknown>;
}

/** One measured number, with the platform's own word for it riding along as provenance. */
export interface PostMetricSample {
  label: MetricLabel;
  value: number;
  /** The platform field this came from, verbatim — what the surface's tooltip shows. */
  platformField: string;
}

export interface PostMetricsReport {
  platform: SocialPlatform;
  /**
   * Every number the platform actually answered. **A label the platform did
   * not answer is simply absent from this array** — never a 0, which is the
   * one lie `publication_metrics` is shaped to keep unrepresentable.
   */
  samples: PostMetricSample[];
  /**
   * What this platform will NOT report, from its capability row — carried on
   * every successful read so a caller holding a report holds the sentence
   * that explains its own gaps. These are the platform's standing refusals,
   * not per-call misses: a label the platform normally reports but omitted
   * this time is simply missing from `samples`, and that absence means
   * "nothing to record", not "never available".
   *
   * Reported, never written: no row is appended for any of these, and the
   * Analytics surface renders the sentence in place of a number.
   */
  unavailable: Array<{ label: MetricLabel; reason: string }>;
}

export interface SocialMetricsReader {
  readonly platform: SocialPlatform;
  /** Reader label for messages and tests ("fake" | "unavailable" | a reader name). */
  readonly name: string;
  /** One read of one post's metrics. Resolves only on a platform answer we could read. */
  fetchPostMetrics(request: PostMetricsRequest): Promise<PostMetricsReport>;
}

/** The refusing reader: exposes its typed refusal so the tick can refuse WITHOUT a call; fetchPostMetrics throws the same error. */
export interface RefusingSocialMetricsReader extends SocialMetricsReader {
  readonly name: "unavailable";
  readonly refusal: SocialMetricsRefusedError;
}

export function isRefusingSocialMetricsReader(
  reader: SocialMetricsReader,
): reader is RefusingSocialMetricsReader {
  return reader.name === "unavailable" && "refusal" in reader;
}

export function refusingSocialMetricsReader(
  platform: SocialPlatform,
  refusal: SocialMetricsRefusedError,
): RefusingSocialMetricsReader {
  return {
    platform,
    name: "unavailable",
    refusal,
    async fetchPostMetrics() {
      throw refusal;
    },
  };
}

/** How a platform registers its reader — credential in, reader out (the SocialDriverFactory shape). */
export type SocialMetricsReaderFactory = (config: { accessToken: string }) => SocialMetricsReader;

/** The readEnv blank-line rule, mirrored: an empty string is not a credential. */
function readCredential(env: EnvSource, key: string): string | undefined {
  const value = env[key];
  return value === undefined || value === "" ? undefined : value;
}

/**
 * THE metrics ratchet — one seat, not two. A reader is returned when the
 * platform's credential seat is filled AND a reader is installed. There is
 * deliberately no `SOCIAL_<P>_ARMED` check: see the seam decision.
 *
 * A platform the capability matrix says has NO ROAD (LinkedIn's double gate,
 * TikTok's absent driver) refuses with the platform's own words BEFORE the
 * credential is even consulted — a gated platform with a perfectly good
 * token is still gated, and telling the operator to check their credential
 * would send them to fix the wrong thing.
 */
export function resolveSocialMetricsReader(
  platform: SocialPlatform,
  env: EnvSource,
  readers: Partial<Record<SocialPlatform, SocialMetricsReaderFactory>> = {},
): SocialMetricsReader {
  const capability: PlatformMetricCapability = metricCapability(platform);

  // The platform's own gate first — a credential cannot open it.
  if (capability.reader === null) {
    const gate = capability.refuses[0];
    if (gate?.permanence === "gated") {
      return refusingSocialMetricsReader(platform, new SocialMetricsGatedError(platform, gate.reason));
    }
    return refusingSocialMetricsReader(
      platform,
      new SocialMetricsUnavailableError(
        platform,
        [gate?.reason ?? `no metrics reader is built for ${platform}`],
        gate?.permanence ?? "no_driver",
      ),
    );
  }

  const keys = socialArmKeys(platform);
  const token = readCredential(env, keys.credential);
  const factory = readers[platform];
  const missing: string[] = [];
  if (!token) missing.push(`${keys.credential} (no connected credential for ${platform})`);
  if (!factory) missing.push(`${platform} metrics reader (none assembled)`);
  if (!token || !factory) {
    return refusingSocialMetricsReader(
      platform,
      new SocialMetricsUnavailableError(platform, missing, "permissioned"),
    );
  }
  return factory({ accessToken: token });
}

export interface FakeSocialMetricsReader extends SocialMetricsReader {
  /** Every request the tick handed over, in order — the tests' assertion surface. */
  readonly calls: PostMetricsRequest[];
}

/**
 * The tests' reader: deterministic numbers, zero network. `failWith`
 * simulates a platform failure AFTER the tick reached the reader — the call
 * is still recorded, so a test can prove the tick got this far while proving
 * nothing landed in `publication_metrics`.
 */
export function createFakeSocialMetricsReader(
  opts: {
    platform?: SocialPlatform;
    samples?: PostMetricSample[];
    unavailable?: Array<{ label: MetricLabel; reason: string }>;
    failWith?: Error;
  } = {},
): FakeSocialMetricsReader {
  const calls: PostMetricsRequest[] = [];
  const platform = opts.platform ?? "bluesky";
  return {
    platform,
    name: "fake",
    calls,
    async fetchPostMetrics(request) {
      calls.push(request);
      if (opts.failWith) throw opts.failWith;
      return {
        platform,
        samples: opts.samples ?? [
          { label: "likes", value: calls.length, platformField: "likeCount" },
        ],
        unavailable: opts.unavailable ?? [],
      };
    },
  };
}
