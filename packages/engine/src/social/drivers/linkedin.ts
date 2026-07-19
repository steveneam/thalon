import { z } from "zod";
import type { SocialPostInput, SocialPublisher, SocialPublishReceipt } from "../registry";
import { responseDetail, responseJson, SocialDriverApiError } from "./errors";

/**
 * B-pub.2 (s65): the LinkedIn driver — the official VERSIONED REST Posts
 * API (ADR 0002: official platform APIs only), posting as the member who
 * owns the access token. The author member id is derived at publish time
 * from the official OpenID Connect userinfo endpoint (`sub` claim), so the
 * driver stays stateless and needs no extra config seat. BUILT in this
 * lane but never executed against the network: nothing constructs it
 * except `productionSocialDrivers` behind `resolveSocialPublisher`'s
 * per-platform arming ratchet, and tests always inject `fetchImpl`.
 *
 * Token requirements (operator-side, never code): an OAuth member token
 * carrying `openid profile` (userinfo) plus `w_member_social` (posting).
 */

/**
 * The pinned LinkedIn-Version month (versioned APIs require it; versions
 * are supported ~1 year from release). Bumping it is a deliberate, tested
 * change — verify against the live API before the first real post.
 */
export const LINKEDIN_VERSION = "202512";

/** The `sub` claim IS the member id the author URN needs. */
const userinfoSchema = z.object({ sub: z.string().min(1) }).loose();

export interface LinkedInDriverConfig {
  accessToken: string;
  /** API base — swappable for a test double. */
  baseUrl?: string;
  /** Injectable fetch (tests) — defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export function createLinkedInDriver(config: LinkedInDriverConfig): SocialPublisher {
  const baseUrl = (config.baseUrl ?? "https://api.linkedin.com").replace(/\/$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  const authorization = `Bearer ${config.accessToken}`;
  return {
    platform: "linkedin",
    name: "linkedin-rest-posts",
    async publish(input: SocialPostInput): Promise<SocialPublishReceipt> {
      // 1. Who owns this token? The userinfo `sub` claim → author URN.
      const whoami = await fetchImpl(`${baseUrl}/v2/userinfo`, {
        headers: { Authorization: authorization },
      });
      if (!whoami.ok) {
        throw new SocialDriverApiError(
          "linkedin",
          whoami.status,
          `userinfo (author lookup) failed: ${await responseDetail(whoami)}`,
        );
      }
      const claims = userinfoSchema.safeParse(await responseJson(whoami));
      if (!claims.success) {
        throw new SocialDriverApiError(
          "linkedin",
          whoami.status,
          "userinfo response carries no `sub` member id — cannot derive the post author",
        );
      }
      const authorUrn = `urn:li:person:${claims.data.sub}`;

      // 2. The post itself. `commentary` is the judged body VERBATIM —
      // LinkedIn's "Little Format" treats some characters ((){}[]<>@|~_*)
      // as markup; escaping would alter the text, so it is deliberately
      // not done (flagged for the founder's first-live-post check).
      const created = await fetchImpl(`${baseUrl}/rest/posts`, {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "LinkedIn-Version": LINKEDIN_VERSION,
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          author: authorUrn,
          commentary: input.text,
          visibility: "PUBLIC",
          distribution: {
            feedDistribution: "MAIN_FEED",
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByViewer: false,
        }),
      });
      if (!created.ok) {
        throw new SocialDriverApiError("linkedin", created.status, await responseDetail(created));
      }
      // The accepted post's URN arrives in the x-restli-id response header.
      const postUrn = created.headers.get("x-restli-id");
      if (!postUrn) {
        throw new SocialDriverApiError(
          "linkedin",
          created.status,
          "2xx response without an x-restli-id post URN — refusing to treat as posted",
        );
      }
      return {
        externalPostId: postUrn,
        meta: {
          authorUrn,
          permalink: `https://www.linkedin.com/feed/update/${postUrn}`,
          apiVersion: LINKEDIN_VERSION,
        },
      };
    },
  };
}
