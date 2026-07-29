import type { SocialPlatform } from "@thalon/contracts";
import type { EnvSource, ThalonEnv } from "@thalon/platform";
import { resolveSocialPublisher, type SocialDriverFactory, type SocialPublisher } from "../registry";
import { createBlueskyDriver } from "./bluesky";
import { createFacebookDriver } from "./facebook";
import { createInstagramDriver } from "./instagram";
import { createLinkedInDriver } from "./linkedin";
import { createRedditDriver } from "./reddit";
import { createXDriver } from "./x";

export {
  hardenedPlatformFetch,
  responseDetail,
  responseJson,
  SocialDriverApiError,
  SocialTokenExpiredError,
} from "./errors";
export { blueskyLinkFacets, createBlueskyDriver, type BlueskyDriverConfig } from "./bluesky";
export { createFacebookDriver, FACEBOOK_GRAPH_VERSION, type FacebookDriverConfig } from "./facebook";
export {
  createInstagramDriver,
  INSTAGRAM_GRAPH_VERSION,
  InstagramPublicMediaUrlRequiredError,
  InstagramTextOnlyUnsupportedError,
  type InstagramDriverConfig,
} from "./instagram";
export { createLinkedInDriver, LINKEDIN_VERSION, type LinkedInDriverConfig } from "./linkedin";
export {
  createRedditDriver,
  redditTitleSplit,
  RedditMediaUnsupportedError,
  type RedditDriverConfig,
} from "./reddit";
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
  };
  // X auth mode from the env seats (B-pub.3): all three 1.0a extras set →
  // signed user-context requests with the NON-EXPIRING token pair
  // (SOCIAL_X_ACCESS_TOKEN = the account's oauth token); anything less →
  // OAuth 2.0 Bearer, exactly the B-pub.2 behavior. All-or-nothing: a
  // partial 1.0a set never half-signs.
  const xApiKey = env.SOCIAL_X_API_KEY;
  const xApiKeySecret = env.SOCIAL_X_API_KEY_SECRET;
  const xTokenSecret = env.SOCIAL_X_ACCESS_TOKEN_SECRET;
  if (xApiKey && xApiKeySecret && xTokenSecret) {
    drivers.x = ({ accessToken }) =>
      createXDriver({
        accessToken,
        oauth1: { apiKey: xApiKey, apiKeySecret: xApiKeySecret, accessTokenSecret: xTokenSecret },
      });
  } else {
    drivers.x = ({ accessToken }) => createXDriver({ accessToken });
  }
  const pageId = env.SOCIAL_FACEBOOK_PAGE_ID;
  if (pageId) {
    drivers.facebook = ({ accessToken }) => createFacebookDriver({ accessToken, pageId });
  }
  const igUserId = env.SOCIAL_INSTAGRAM_USER_ID;
  if (igUserId) {
    drivers.instagram = ({ accessToken }) => createInstagramDriver({ accessToken, igUserId });
  }
  // D1 (s83): reddit is token-only (the target derives from /api/v1/me or
  // the tenant's settings pass-through); bluesky mirrors the facebook shape —
  // no identifier extra, no factory, and the arming ladder names it. The
  // bluesky ACCESS_TOKEN seat carries the app password by declaration
  // (platform env schema): the seat holds the platform's own secret shape.
  drivers.reddit = ({ accessToken }) => createRedditDriver({ accessToken });
  const blueskyIdentifier = env.SOCIAL_BLUESKY_IDENTIFIER;
  if (blueskyIdentifier) {
    drivers.bluesky = ({ accessToken }) =>
      createBlueskyDriver({ appPassword: accessToken, identifier: blueskyIdentifier });
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
    SOCIAL_REDDIT_ACCESS_TOKEN: env.SOCIAL_REDDIT_ACCESS_TOKEN,
    SOCIAL_REDDIT_ARMED: env.SOCIAL_REDDIT_ARMED,
    SOCIAL_BLUESKY_ACCESS_TOKEN: env.SOCIAL_BLUESKY_ACCESS_TOKEN,
    SOCIAL_BLUESKY_ARMED: env.SOCIAL_BLUESKY_ARMED,
  };
  return (platform) => resolveSocialPublisher(platform, source, drivers);
}
