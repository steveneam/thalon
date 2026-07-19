import type { SocialPlatform } from "@thalon/contracts";
import type { ThalonEnv } from "@thalon/platform";
import type { SocialDriverFactory } from "../registry";
import { createFacebookDriver } from "./facebook";
import { createInstagramDriver } from "./instagram";
import { createLinkedInDriver } from "./linkedin";
import { createXDriver } from "./x";

export { responseDetail, responseJson, SocialDriverApiError } from "./errors";
export { createFacebookDriver, FACEBOOK_GRAPH_VERSION, type FacebookDriverConfig } from "./facebook";
export {
  createInstagramDriver,
  InstagramTextOnlyUnsupportedError,
  type InstagramDriverConfig,
} from "./instagram";
export { createLinkedInDriver, LINKEDIN_VERSION, type LinkedInDriverConfig } from "./linkedin";
export { createXDriver, type XDriverConfig } from "./x";

/**
 * B-pub.2 (s65): the production driver map `resolveSocialPublisher` takes —
 * the ONLY place drivers meet config. Credentials stay OUT of this map (the
 * ratchet passes them per-resolution after its own arming checks); what
 * assembles here is driver EXTRAS from the validated env. A platform whose
 * extra is missing contributes NO factory, so the arming ladder names the
 * missing driver honestly instead of a driver failing half-configured.
 * TikTok is deliberately absent: platform-review-gated, downstream
 * (kickoff scope), so its arming pair can never resolve past the ladder.
 */
export function productionSocialDrivers(
  env: ThalonEnv,
): Partial<Record<SocialPlatform, SocialDriverFactory>> {
  const drivers: Partial<Record<SocialPlatform, SocialDriverFactory>> = {
    linkedin: ({ accessToken }) => createLinkedInDriver({ accessToken }),
    x: ({ accessToken }) => createXDriver({ accessToken }),
  };
  const pageId = env.SOCIAL_FACEBOOK_PAGE_ID;
  if (pageId) {
    drivers.facebook = ({ accessToken }) => createFacebookDriver({ accessToken, pageId });
  }
  const igUserId = env.SOCIAL_INSTAGRAM_USER_ID;
  if (igUserId) {
    drivers.instagram = ({ accessToken }) => createInstagramDriver({ accessToken, igUserId });
  }
  return drivers;
}
