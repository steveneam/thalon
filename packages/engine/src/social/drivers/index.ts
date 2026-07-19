import type { SocialPlatform } from "@thalon/contracts";
import type { EnvSource, ThalonEnv } from "@thalon/platform";
import { resolveSocialPublisher, type SocialDriverFactory, type SocialPublisher } from "../registry";
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

/**
 * The post loop's production caller wiring (s67): validated env in, the
 * publish door's per-platform resolver out. The EnvSource handed to the
 * arming ratchet is rebuilt from the validated env's DECLARED SOCIAL_*
 * pairs — packages/platform stays the process environment's only reader,
 * and a key the env schema doesn't declare can never arm anything. Every
 * resolution still walks the untouched per-platform ratchet: credential +
 * founder-GO flag + an assembled driver, else a refusing publisher that
 * names its missing arms.
 */
export function productionSocialPublisherResolver(
  env: ThalonEnv,
): (platform: SocialPlatform) => SocialPublisher {
  const drivers = productionSocialDrivers(env);
  const source: EnvSource = {
    SOCIAL_LINKEDIN_ACCESS_TOKEN: env.SOCIAL_LINKEDIN_ACCESS_TOKEN,
    SOCIAL_LINKEDIN_ARMED: env.SOCIAL_LINKEDIN_ARMED,
    SOCIAL_X_ACCESS_TOKEN: env.SOCIAL_X_ACCESS_TOKEN,
    SOCIAL_X_ARMED: env.SOCIAL_X_ARMED,
    SOCIAL_FACEBOOK_ACCESS_TOKEN: env.SOCIAL_FACEBOOK_ACCESS_TOKEN,
    SOCIAL_FACEBOOK_ARMED: env.SOCIAL_FACEBOOK_ARMED,
    SOCIAL_INSTAGRAM_ACCESS_TOKEN: env.SOCIAL_INSTAGRAM_ACCESS_TOKEN,
    SOCIAL_INSTAGRAM_ARMED: env.SOCIAL_INSTAGRAM_ARMED,
    SOCIAL_TIKTOK_ACCESS_TOKEN: env.SOCIAL_TIKTOK_ACCESS_TOKEN,
    SOCIAL_TIKTOK_ARMED: env.SOCIAL_TIKTOK_ARMED,
  };
  return (platform) => resolveSocialPublisher(platform, source, drivers);
}
