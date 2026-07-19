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
