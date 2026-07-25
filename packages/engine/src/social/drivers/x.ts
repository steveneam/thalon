import { z } from "zod";
import type { SocialPostInput, SocialPublisher, SocialPublishReceipt } from "../registry";
import { responseDetail, responseJson, SocialDriverApiError } from "./errors";

/**
 * B-pub.2 (s65): the X driver — the official v2 create-post endpoint
 * (ADR 0002: official platform APIs only), posting as the user the OAuth
 * 2.0 user-context token belongs to. BUILT in this lane but never executed
 * against the network: nothing constructs it except
 * `productionSocialDrivers` behind the arming ratchet, and tests always
 * inject `fetchImpl`.
 *
 * Token requirements (operator-side, never code): an OAuth 2.0
 * user-context access token carrying `tweet.write` + `users.read`.
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
  accessToken: string;
  /** API base — swappable for a test double. */
  baseUrl?: string;
  /** Injectable fetch (tests) — defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export function createXDriver(config: XDriverConfig): SocialPublisher {
  const baseUrl = (config.baseUrl ?? "https://api.x.com").replace(/\/$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
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
          headers: { Authorization: `Bearer ${config.accessToken}` },
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
          Authorization: `Bearer ${config.accessToken}`,
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
