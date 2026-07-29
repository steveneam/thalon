import { z } from "zod";
import type { SocialPostInput, SocialPublisher, SocialPublishReceipt } from "../registry";
import { metricCapability } from "../metrics/capability";
import { SocialMetricsPermissionError, SocialMetricsUnreadableError } from "../metrics/errors";
import { collectSample } from "../metrics/parse";
import type {
  PostMetricSample,
  PostMetricsReport,
  SocialMetricsReader,
} from "../metrics/registry";
import { responseDetail, responseJson, SocialDriverApiError } from "./errors";
import { oauth1Header, type OAuth1Keys } from "./oauth1";

/**
 * B-pub.2 (s65): the X driver — the official v2 create-post endpoint
 * (ADR 0002: official platform APIs only), posting as the user the token
 * belongs to. BUILT in this lane but never executed against the network:
 * nothing constructs it except `productionSocialDrivers` behind the arming
 * ratchet, and tests always inject `fetchImpl`.
 *
 * Auth (operator-side, never code) — two official modes, picked at
 * assembly from which env seats are set:
 *  - OAuth 1.0a user context (B-pub.3, the STANDING-ARM mode): the app's
 *    consumer pair + the account's non-expiring token pair sign every
 *    request. This is the only mode that can stay armed — OAuth 2.0 user
 *    tokens expire in ~2 hours and refresh machinery is B-int.4.
 *  - OAuth 2.0 user-context Bearer (`tweet.write users.read media.write`):
 *    works while fresh; fine for a supervised one-off.
 */

/** The one field a post NEEDS from the platform — the accepted-post id the ledger requires. */
const createPostResponseSchema = z
  .object({ data: z.object({ id: z.string().min(1) }).loose() })
  .loose();

/** The media upload's essential: the media id the tweet body attaches. */
const mediaUploadResponseSchema = z
  .object({ data: z.object({ id: z.string().min(1) }).loose() })
  .loose();

export interface XDriverConfig {
  /** OAuth 2.0 user Bearer — or, in 1.0a mode, the account's oauth token (`oauth1.token`). */
  accessToken: string;
  /**
   * OAuth 1.0a mode (B-pub.3): the app consumer pair + the account token
   * secret; `accessToken` is the account's oauth token. All-or-nothing at
   * assembly — a partial set never half-signs.
   */
  oauth1?: { apiKey: string; apiKeySecret: string; accessTokenSecret: string };
  /** API base — swappable for a test double. */
  baseUrl?: string;
  /** Injectable fetch (tests) — defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export function createXDriver(config: XDriverConfig): SocialPublisher {
  const baseUrl = (config.baseUrl ?? "https://api.x.com").replace(/\/$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  const oauth1Keys: OAuth1Keys | undefined = config.oauth1
    ? {
        consumerKey: config.oauth1.apiKey,
        consumerSecret: config.oauth1.apiKeySecret,
        token: config.accessToken,
        tokenSecret: config.oauth1.accessTokenSecret,
      }
    : undefined;
  const authFor = (url: string): string =>
    oauth1Keys ? oauth1Header("POST", url, oauth1Keys) : `Bearer ${config.accessToken}`;
  return {
    platform: "x",
    name: "x-v2-create-post",
    async publish(input: SocialPostInput): Promise<SocialPublishReceipt> {
      // B-pub.3 media leg: the official v2 media upload (one image; the
      // door ceilings at one) — multipart bytes in, media id out, attached
      // to the tweet body. Requires the `media.write` scope on the user
      // token (operator-side; verify with the version pins before the
      // first live media post).
      let mediaIds: string[] | undefined;
      if (input.media && input.media.length > 0) {
        const [image] = input.media;
        const form = new FormData();
        form.set("media", new Blob([new Uint8Array(image.bytes)], { type: image.contentType }));
        form.set("media_category", "tweet_image");
        const uploaded = await fetchImpl(`${baseUrl}/2/media/upload`, {
          method: "POST",
          headers: { Authorization: authFor(`${baseUrl}/2/media/upload`) },
          body: form,
        });
        if (!uploaded.ok) {
          throw new SocialDriverApiError(
            "x",
            uploaded.status,
            `media upload failed: ${await responseDetail(uploaded)}`,
          );
        }
        const parsed = mediaUploadResponseSchema.safeParse(await responseJson(uploaded));
        if (!parsed.success) {
          throw new SocialDriverApiError(
            "x",
            uploaded.status,
            "media upload response carries no media id — cannot attach the image",
          );
        }
        mediaIds = [parsed.data.data.id];
      }
      // `text` is the judged body VERBATIM — length policy is the
      // platform's to enforce: an over-limit body comes back as the
      // platform's own non-2xx, never a driver-side trim.
      const response = await fetchImpl(`${baseUrl}/2/tweets`, {
        method: "POST",
        headers: {
          Authorization: authFor(`${baseUrl}/2/tweets`),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: input.text,
          ...(mediaIds ? { media: { media_ids: mediaIds } } : {}),
        }),
      });
      if (!response.ok) {
        throw new SocialDriverApiError("x", response.status, await responseDetail(response));
      }
      const parsed = createPostResponseSchema.safeParse(await responseJson(response));
      if (!parsed.success) {
        throw new SocialDriverApiError(
          "x",
          response.status,
          "2xx response without an accepted-post id — refusing to treat as posted",
        );
      }
      const postId = parsed.data.data.id;
      return {
        externalPostId: postId,
        // The username-less canonical status URL — resolves for any author.
        meta: { permalink: `https://x.com/i/web/status/${postId}` },
      };
    },
  };
}

/**
 * D2 (s87): X's METRICS reader — `GET /2/tweets?ids=…&tweet.fields=public_metrics`,
 * which the docs place behind any authentication method, for any post, with
 * no time limit. It is the only one of our platforms that hands over an
 * impressions figure without a special permission.
 *
 * ⚠ AND THE ONLY ONE THAT SPENDS MONEY. X's API is metered pay-per-use with
 * no free read tier: every post this reader measures is a billed resource.
 * The capability matrix carries that as `metered` and the tick reports it —
 * it is the founder's call, not a fact to bury in a driver.
 *
 * ⚠ AUTH: in 1.0a mode this is a signed GET WITH A QUERY STRING, which is
 * why `oauth1Header` learned RFC 5849 §3.4.1 query handling in this lane.
 * Signing the query-bearing URL as if it were a bare POST endpoint produces
 * a 401 that looks exactly like a dead credential — a debugging trap this
 * driver would have walked into on its first live read.
 *
 * Deliberately NOT read: organic_metrics / non_public_metrics. They would
 * add link and profile clicks for our own posts, but only within 30 days of
 * posting — a series that silently stops on day 31 leaves a hole nothing can
 * tell apart from a failed tick.
 */
export function createXMetricsReader(config: XDriverConfig): SocialMetricsReader {
  const baseUrl = (config.baseUrl ?? "https://api.x.com").replace(/\/$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  const oauth1Keys: OAuth1Keys | undefined = config.oauth1
    ? {
        consumerKey: config.oauth1.apiKey,
        consumerSecret: config.oauth1.apiKeySecret,
        token: config.accessToken,
        tokenSecret: config.oauth1.accessTokenSecret,
      }
    : undefined;
  return {
    platform: "x",
    name: "x-v2-public-metrics",
    async fetchPostMetrics({ externalPostId }): Promise<PostMetricsReport> {
      const url =
        `${baseUrl}/2/tweets?ids=${encodeURIComponent(externalPostId)}` +
        `&tweet.fields=${encodeURIComponent("public_metrics")}`;
      const response = await fetchImpl(url, {
        headers: {
          Authorization: oauth1Keys ? oauth1Header("GET", url, oauth1Keys) : `Bearer ${config.accessToken}`,
        },
      });
      if (!response.ok) {
        const detail = await responseDetail(response);
        if (response.status === 401 || response.status === 403) {
          throw new SocialMetricsPermissionError("x", response.status, detail);
        }
        throw new SocialDriverApiError("x", response.status, detail);
      }
      const parsed = publicMetricsSchema.safeParse(await responseJson(response));
      const metrics = parsed.success ? parsed.data.data?.[0]?.public_metrics : undefined;
      if (!metrics) {
        // X reports a missing/withheld post under `errors`, with a 200. A
        // deleted post has no metrics — and gets no invented ones.
        throw new SocialMetricsUnreadableError(
          "x",
          `no public_metrics for post "${externalPostId}" — deleted, withheld, or not visible to this credential`,
        );
      }
      const samples: PostMetricSample[] = [];
      collectSample(samples, "x", "impressions", metrics.impression_count);
      collectSample(samples, "x", "likes", metrics.like_count);
      collectSample(samples, "x", "replies", metrics.reply_count);
      collectSample(samples, "x", "reposts", metrics.retweet_count);
      collectSample(samples, "x", "quotes", metrics.quote_count);
      collectSample(samples, "x", "bookmarks", metrics.bookmark_count);
      return {
        platform: "x",
        samples,
        unavailable: metricCapability("x").refuses.map((r) => ({ label: r.label, reason: r.reason })),
      };
    },
  };
}

/** The public_metrics slice — every count optional, so a field X stops sending becomes an absence, not a zero. */
const publicMetricsSchema = z.object({
  data: z
    .array(
      z
        .object({
          id: z.string().optional(),
          public_metrics: z
            .object({
              impression_count: z.number().optional(),
              like_count: z.number().optional(),
              reply_count: z.number().optional(),
              retweet_count: z.number().optional(),
              quote_count: z.number().optional(),
              bookmark_count: z.number().optional(),
            })
            .loose()
            .optional(),
        })
        .loose(),
    )
    .optional(),
});
