import { z } from "zod";
import type { SocialPostInput, SocialPublisher, SocialPublishReceipt } from "../registry";
import { metricCapability } from "../metrics/capability";
import { SocialMetricsUnreadableError } from "../metrics/errors";
import { collectSample, reclassifyMetricsError } from "../metrics/parse";
import type {
  PostMetricSample,
  PostMetricsReport,
  SocialMetricsReader,
} from "../metrics/registry";
import {
  hardenedPlatformFetch,
  responseDetail,
  responseJson,
  SocialDriverApiError,
} from "./errors";

/**
 * B-pub.2 (s65): the Facebook driver — the official Graph API Page feed
 * post (ADR 0002: official platform APIs only). The ACCESS_TOKEN arming
 * slot carries the PAGE access token; the Page id is the driver's config
 * extra (`SOCIAL_FACEBOOK_PAGE_ID`), closed over at assembly time because
 * the frozen `SocialDriverFactory` shape passes credentials only. BUILT in
 * this lane but never executed against the network: tests always inject
 * `fetchImpl`.
 *
 * Token requirements (operator-side, never code): a Page access token
 * whose backing user granted `pages_manage_posts` on the target Page.
 * The token travels ONLY in the Authorization header — never as the
 * conventional access_token query/body parameter, which leaks into URL
 * logs.
 */

/**
 * The pinned Graph API version. Versions are supported ~2 years from
 * release; bumping is a deliberate, tested change — verify against the
 * live API before the first real post.
 */
export const FACEBOOK_GRAPH_VERSION = "v23.0";

/** The one field a post NEEDS from the platform — the accepted `{page-id}_{post-id}` composite id. */
const feedPostResponseSchema = z.object({ id: z.string().min(1) }).loose();

/**
 * The photo publish's essentials: `post_id` is the FEED post the photo
 * created (the ledger id the permalink hangs off); `id` (the photo node)
 * is the fallback when the API omits post_id.
 */
const photoPostResponseSchema = z
  .object({ id: z.string().min(1), post_id: z.string().min(1).optional() })
  .loose();

export interface FacebookDriverConfig {
  accessToken: string;
  /** The target Page id (SOCIAL_FACEBOOK_PAGE_ID) — assembly-time config, not a credential. */
  pageId: string;
  /** API base — swappable for a test double. */
  baseUrl?: string;
  /** Injectable fetch (tests) — defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export function createFacebookDriver(config: FacebookDriverConfig): SocialPublisher {
  const baseUrl = (config.baseUrl ?? "https://graph.facebook.com").replace(/\/$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  return {
    platform: "facebook",
    name: "facebook-page-feed",
    async publish(input: SocialPostInput): Promise<SocialPublishReceipt> {
      // B-pub.3 media leg: a Page photo post — the official Graph
      // `/{page-id}/photos` publish (one image; the door ceilings at one).
      // `caption` carries the judged body VERBATIM; the token stays in the
      // Authorization header, never the form body or URL.
      if (input.media && input.media.length > 0) {
        const [image] = input.media;
        const form = new FormData();
        form.set("source", new Blob([new Uint8Array(image.bytes)], { type: image.contentType }));
        form.set("caption", input.text);
        const response = await fetchImpl(
          `${baseUrl}/${FACEBOOK_GRAPH_VERSION}/${config.pageId}/photos`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${config.accessToken}` },
            body: form,
          },
        );
        if (!response.ok) {
          throw new SocialDriverApiError(
            "facebook",
            response.status,
            `photo publish failed: ${await responseDetail(response)}`,
          );
        }
        const parsed = photoPostResponseSchema.safeParse(await responseJson(response));
        if (!parsed.success) {
          throw new SocialDriverApiError(
            "facebook",
            response.status,
            "2xx photo response without a photo/post id — refusing to treat as posted",
          );
        }
        const externalPostId = parsed.data.post_id ?? parsed.data.id;
        return {
          externalPostId,
          meta: { pageId: config.pageId, photoId: parsed.data.id, apiVersion: FACEBOOK_GRAPH_VERSION },
        };
      }
      // `message` is the judged body VERBATIM. Form encoding is the Graph
      // API's canonical POST body shape.
      const response = await fetchImpl(
        `${baseUrl}/${FACEBOOK_GRAPH_VERSION}/${config.pageId}/feed`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ message: input.text }).toString(),
        },
      );
      if (!response.ok) {
        throw new SocialDriverApiError("facebook", response.status, await responseDetail(response));
      }
      const parsed = feedPostResponseSchema.safeParse(await responseJson(response));
      if (!parsed.success) {
        throw new SocialDriverApiError(
          "facebook",
          response.status,
          "2xx response without an accepted-post id — refusing to treat as posted",
        );
      }
      const postId = parsed.data.id;
      return {
        externalPostId: postId,
        meta: {
          // The composite `{page-id}_{post-id}` id resolves as a canonical permalink.
          permalink: `https://www.facebook.com/${postId}`,
          apiVersion: FACEBOOK_GRAPH_VERSION,
        },
      };
    },
  };
}

/**
 * D2 (s87): Facebook's METRICS reader — `GET /{post-id}/insights?metric=…`
 * under `read_insights` + `pages_read_engagement`, with a Page token from
 * someone holding the ANALYZE task on the Page.
 *
 * ⚠ THE IMPRESSIONS FAMILY IS RETIRED, and this reader is shaped by that.
 * Meta removed `post_impressions_unique` on 2025-06-15 and `post_impressions`
 * on 2025-11-15, pointing callers at `post_media_view`. Asking for the old
 * names now returns an invalid-metric error, so they are not asked for at
 * all. The unique-audience column survives under a different platform word —
 * `post_total_media_view_unique` — which is what the capability matrix maps
 * to `reach`. Anyone reading a Facebook reach number from before that date
 * is reading a different metric; the matrix records the swap so nobody has to
 * rediscover it.
 *
 * `post_reactions_by_type_total` answers a MAP of reaction type → count, so
 * its total is summed here. That is the metric's own stated meaning, not a
 * derivation this reader invented — and the sum only ever includes numbers
 * the platform actually sent.
 */
export function createFacebookMetricsReader(config: FacebookDriverConfig): SocialMetricsReader {
  const baseUrl = (config.baseUrl ?? "https://graph.facebook.com").replace(/\/$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  const metrics = ["post_media_view", "post_total_media_view_unique", "post_clicks", "post_reactions_by_type_total"];
  return {
    platform: "facebook",
    name: "facebook-post-insights",
    async fetchPostMetrics({ externalPostId }): Promise<PostMetricsReport> {
      const url =
        `${baseUrl}/${FACEBOOK_GRAPH_VERSION}/${encodeURIComponent(externalPostId)}/insights` +
        `?metric=${encodeURIComponent(metrics.join(","))}`;
      let response;
      try {
        response = await hardenedPlatformFetch(
          "facebook",
          fetchImpl,
          url,
          { headers: { Authorization: `Bearer ${config.accessToken}` } },
        );
      } catch (err) {
        // Graph answers a missing insights permission with a 400, not a 401,
        // so the hardened fetch cannot tell it from any other refusal. This
        // is the difference between "reconnect with the metrics scope" and an
        // unexplained failure the operator can do nothing with.
        throw reclassifyMetricsError("facebook", err);
      }
      const parsed = insightsSchema.safeParse(await responseJson(response));
      if (!parsed.success) {
        throw new SocialMetricsUnreadableError(
          "facebook",
          `insights answered without a readable data array for post "${externalPostId}"`,
        );
      }
      const samples: PostMetricSample[] = [];
      for (const entry of parsed.data.data) {
        // Insights values are a series; a lifetime metric carries one entry.
        // The LAST value is the current one.
        const raw = entry.values?.[entry.values.length - 1]?.value;
        switch (entry.name) {
          case "post_media_view":
            collectSample(samples, "facebook", "views", raw);
            break;
          case "post_total_media_view_unique":
            collectSample(samples, "facebook", "reach", raw);
            break;
          case "post_clicks":
            collectSample(samples, "facebook", "clicks", raw);
            break;
          case "post_reactions_by_type_total":
            collectSample(samples, "facebook", "reactions", sumReactionTypes(raw));
            break;
          default:
            // A metric we did not ask for: ignored, never guessed at.
            break;
        }
      }
      return {
        platform: "facebook",
        samples,
        unavailable: metricCapability("facebook").refuses.map((r) => ({
          label: r.label,
          reason: r.reason,
        })),
      };
    },
  };
}

/**
 * `post_reactions_by_type_total` answers `{ like: 5, love: 2, … }`. Sum the
 * numeric members; a value that is not a map of numbers yields NOTHING
 * rather than 0, so a shape change surfaces as an honest absence.
 */
function sumReactionTypes(raw: unknown): number | undefined {
  if (raw === null || typeof raw !== "object") return undefined;
  let total = 0;
  let sawOne = false;
  for (const value of Object.values(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      total += value;
      sawOne = true;
    }
  }
  return sawOne ? total : undefined;
}

/** The insights envelope: named metrics, each with a values series whose last entry is current. */
const insightsSchema = z.object({
  data: z.array(
    z
      .object({
        name: z.string(),
        values: z.array(z.object({ value: z.unknown() }).loose()).optional(),
      })
      .loose(),
  ),
});
