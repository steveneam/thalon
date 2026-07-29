import { z } from "zod";
import { PublishRefusedError } from "../errors";
import type { SocialPostInput, SocialPublisher, SocialPublishReceipt } from "../registry";
import { hardenedPlatformFetch, responseJson, SocialDriverApiError, type Sleeper } from "./errors";

/**
 * B-ig.1 (s85): the Instagram driver — the official two-step content-publish
 * flow (ADR 0002: official platform APIs only):
 *
 *   1. POST /{ig-user-id}/media          → a CONTAINER (`image_url` + caption)
 *   2. POST /{ig-user-id}/media_publish  → the feed post (`creation_id`)
 *
 * It replaces B-pub.2's blanket refusal behind the same factory seat, and
 * KEEPS that refusal for the case that earned it: a text-only draft. That
 * was never a placeholder — Instagram genuinely has no text-only feed post,
 * and faking one (text-on-image rendering, caption-only tricks) would alter
 * the judged body's meaning. So the honesty case survives as a rung, not as
 * the whole driver.
 *
 * THE THING THAT MAKES THIS DRIVER DIFFERENT FROM EVERY OTHER ONE: step 1
 * takes `image_url`, a PUBLIC address that Meta's servers fetch anonymously.
 * Instagram never accepts uploaded bytes. Holding the image is therefore not
 * enough to publish it — the door must have made it reachable first
 * (`needsPublicMediaUrl` → `SocialPostMedia.publicUrl`, ../publish.ts). When
 * it did not, this driver REFUSES: posting the caption alone would publish a
 * different post than the operator approved, which is the same invariant the
 * door states for a missing artifact ("never a silent text-only post").
 *
 * Format constraints are NOT re-litigated here: the frozen capability matrix
 * already states Instagram as `media.required` with `imageContentTypes:
 * ["image/jpeg"]`, so the fit validator (../capability.ts) refuses a PNG or
 * a text-only draft one rung earlier, before a call is ever spent. Video and
 * carousels are out of scope for this lane (the door's `mediaRefs` ceiling is
 * one image/*).
 *
 * BUILT but never executed against the network: tests always inject
 * `fetchImpl`. Live Instagram posting needs its own per-platform founder GO,
 * which does NOT exist — the arming ratchet is untouched by this file.
 *
 * Token requirements (operator-side, never code): an access token for the
 * Facebook Page linked to the IG professional account, whose backing user
 * granted `instagram_basic` + `instagram_content_publish`. The token travels
 * ONLY in the Authorization header — never as the conventional `access_token`
 * query/body parameter, which leaks into URL logs.
 */

/**
 * The pinned Graph API version — Instagram's publish endpoints live on the
 * Facebook Graph host (the IG dance rides the same Meta app; see the platform
 * env schema). Pinned separately from FACEBOOK_GRAPH_VERSION on purpose: two
 * drivers, two independently-verifiable bumps.
 */
export const INSTAGRAM_GRAPH_VERSION = "v23.0";

/** Step 1's only load-bearing field: the container id step 2 publishes. */
const containerResponseSchema = z.object({ id: z.string().min(1) }).loose();

/** Step 2's only load-bearing field: the published media id — the ledger's external id. */
const publishResponseSchema = z.object({ id: z.string().min(1) }).loose();

/**
 * The typed refusal for a TEXT-ONLY draft — a `PublishRefusedError` so
 * callers file it as "the platform can't take this format", never
 * infrastructure failure. Preserved verbatim in kind from B-pub.2: the
 * constraint it names is the platform's, and it did not go away when the
 * media path landed.
 */
export class InstagramTextOnlyUnsupportedError extends PublishRefusedError {
  readonly refusal = "platform_requires_media";
  constructor(public readonly draftId: string) {
    super(
      `instagram cannot publish draft "${draftId}": the official content-publish flow requires image or video media — a text-only post draft has no IG feed form. Attach an image to the draft (meta.mediaRefs) and the media path publishes it; nothing was posted and nothing was recorded.`,
    );
    this.name = "InstagramTextOnlyUnsupportedError";
  }
}

/**
 * The typed refusal for "we hold the image but it has no public address".
 * Distinct from the text-only case because the CAUSE is ours, not the
 * platform's: the draft carries an image, Instagram would take it, and the
 * door could not make it reachable. Refusing here is the honest end — the
 * alternative is publishing the caption alone, i.e. a different post than
 * the one approved.
 */
export class InstagramPublicMediaUrlRequiredError extends PublishRefusedError {
  readonly refusal = "public_media_url_unavailable";
  constructor(public readonly draftId: string) {
    super(
      `instagram cannot publish draft "${draftId}": its image has no public URL. Instagram's /media container fetches "image_url" from our own origin — it never accepts uploaded bytes — so an image the platform cannot reach cannot be posted. Refusing rather than publishing the caption alone; nothing was posted and nothing was recorded.`,
    );
    this.name = "InstagramPublicMediaUrlRequiredError";
  }
}

export interface InstagramDriverConfig {
  accessToken: string;
  /** The IG professional-account user id (SOCIAL_INSTAGRAM_USER_ID) — assembly-time config, not a credential. */
  igUserId: string;
  /** API base — swappable for a test double. */
  baseUrl?: string;
  /** Injectable fetch (tests) — defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable pause so the hardened fetch's 429 retries stay deterministic under test. */
  sleep?: Sleeper;
}

export function createInstagramDriver(config: InstagramDriverConfig): SocialPublisher {
  const baseUrl = (config.baseUrl ?? "https://graph.facebook.com").replace(/\/$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  const endpoint = (edge: string) =>
    `${baseUrl}/${INSTAGRAM_GRAPH_VERSION}/${config.igUserId}/${edge}`;
  const form = (fields: Record<string, string>) => ({
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields).toString(),
  });

  return {
    platform: "instagram",
    name: "instagram-media-publish",
    // The declaration that makes the door admit this image publicly at all.
    needsPublicMediaUrl: true,
    async publish(input: SocialPostInput): Promise<SocialPublishReceipt> {
      // The honesty rungs, in cause order: no image at all is the PLATFORM's
      // constraint; an image with no address is OURS. Both refuse before any
      // call — a refusal is never spent as a live API request.
      const image = input.media?.[0];
      if (!image) throw new InstagramTextOnlyUnsupportedError(input.draftId);
      if (!image.publicUrl) throw new InstagramPublicMediaUrlRequiredError(input.draftId);

      // Step 1 — the container. `caption` carries the judged body VERBATIM.
      // Meta dereferences image_url DURING this call, so a container id
      // coming back means the bytes are already on their side: the address
      // is not needed after this response, which is what lets the door
      // revoke the admission immediately.
      const containerRes = await hardenedPlatformFetch(
        "instagram",
        fetchImpl,
        endpoint("media"),
        form({
          image_url: image.publicUrl,
          caption: input.text,
          ...(image.altText ? { alt_text: image.altText } : {}),
        }),
        { sleep: config.sleep },
      );
      const container = containerResponseSchema.safeParse(await responseJson(containerRes));
      if (!container.success) {
        throw new SocialDriverApiError(
          "instagram",
          containerRes.status,
          "2xx container response without a creation id — refusing to treat as posted",
        );
      }

      // Step 2 — publish the container. A failure HERE leaves an unpublished
      // container behind, which Meta expires on its own (~24h); nothing
      // reached the feed, so the error surfaces as-is with no cleanup call
      // to invent.
      const publishRes = await hardenedPlatformFetch(
        "instagram",
        fetchImpl,
        endpoint("media_publish"),
        form({ creation_id: container.data.id }),
        { sleep: config.sleep },
      );
      const published = publishResponseSchema.safeParse(await responseJson(publishRes));
      if (!published.success) {
        throw new SocialDriverApiError(
          "instagram",
          publishRes.status,
          `2xx publish response without a media id (container ${container.data.id} was created) — refusing to treat as posted`,
        );
      }

      // No permalink is invented (ADR 0002): Instagram returns one only from
      // a separate GET on the media node, and a fabricated URL in the ledger
      // is worse than an absent one.
      return {
        externalPostId: published.data.id,
        meta: {
          igUserId: config.igUserId,
          creationId: container.data.id,
          apiVersion: INSTAGRAM_GRAPH_VERSION,
        },
      };
    },
  };
}
