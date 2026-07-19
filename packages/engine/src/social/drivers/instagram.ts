import { PublishRefusedError } from "../errors";
import type { SocialPublisher, SocialPublishReceipt } from "../registry";

/**
 * B-pub.2 (s65): the Instagram driver — the HONESTY CASE. The official
 * content-publish flow (`/{ig-user-id}/media` → `/media_publish`) REQUIRES
 * image or video media: a text-only `post` draft cannot become an IG feed
 * post, and no official text-only surface exists. Faking one (text-on-
 * image rendering, caption-only tricks) would alter the judged body's
 * meaning — so this driver arms structurally (the ladder resolves it when
 * the credential + founder GO + user-id extra are set) and refuses every
 * publish with ONE typed error naming the real platform constraint. The
 * media path arrives with a later video/asset bucket and replaces this
 * refusal behind the same factory seat.
 */

/** The typed refusal — a `PublishRefusedError` so callers file it as "the platform can't take this format", never infrastructure failure. */
export class InstagramTextOnlyUnsupportedError extends PublishRefusedError {
  readonly refusal = "platform_requires_media";
  constructor(public readonly draftId: string) {
    super(
      `instagram cannot publish draft "${draftId}": the official content-publish flow requires image or video media — a text-only post draft has no IG feed form. The media path arrives with a later asset bucket; nothing was posted and nothing was recorded.`,
    );
    this.name = "InstagramTextOnlyUnsupportedError";
  }
}

export interface InstagramDriverConfig {
  accessToken: string;
  /** The IG professional-account user id (SOCIAL_INSTAGRAM_USER_ID) — the config seat the future media path publishes through. */
  igUserId: string;
}

export function createInstagramDriver(_config: InstagramDriverConfig): SocialPublisher {
  return {
    platform: "instagram",
    name: "instagram-text-refusal",
    async publish(input): Promise<SocialPublishReceipt> {
      // No fetch, ever: the refusal is deterministic, so no network call
      // exists to fake — the config (token included) is deliberately unused
      // until the media path lands.
      throw new InstagramTextOnlyUnsupportedError(input.draftId);
    },
  };
}
