import { z } from "zod";
import type { SocialPostInput, SocialPublisher, SocialPublishReceipt } from "../registry";
import { responseDetail, responseJson, SocialDriverApiError } from "./errors";

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
