import { z } from "zod";
import type { SocialPostInput, SocialPublisher, SocialPublishReceipt } from "../registry";
import {
  hardenedPlatformFetch,
  responseJson,
  SocialDriverApiError,
  type Sleeper,
} from "./errors";

/**
 * s90 (youtube-destination lane): the YouTube driver — the official YouTube
 * Data API v3 `videos.insert` RESUMABLE upload (ADR 0002: official platform
 * APIs only). Checked 2026-08-01 against the live Google docs:
 *
 *   - https://developers.google.com/youtube/v3/docs/videos/insert — the
 *     endpoint, `uploadType=resumable`, scope `youtube.upload`, accepted
 *     media types `video/*`;
 *   - https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
 *     — the two-step dance: POST the metadata to open a session (the upload
 *     URL arrives in the `Location` header), then PUT the bytes to it;
 *   - https://developers.google.com/youtube/v3/docs/videos — `snippet.title`
 *     max 100 characters, `snippet.description` max 5000 BYTES, both barred
 *     from containing `<` or `>`; `status.selfDeclaredMadeForKids` (the
 *     COPPA declaration) and `status.privacyStatus`.
 *
 * BUILT DISARMED. The token seat (`SOCIAL_YOUTUBE_ACCESS_TOKEN`) is derived
 * by `socialArmKeys` but deliberately NOT declared in the platform env
 * schema, and youtube is NOT in the vault's social destinations — both land
 * with the founder's Google portal app window (the LIVE half). Until then
 * no production resolution can hand this factory a credential, and tests
 * always inject `fetchImpl`.
 *
 * The bearer token travels ONLY in the Authorization header — Google also
 * accepts an `access_token` query parameter, which is exactly the URL-log
 * leak the facebook driver's rule forbids.
 *
 * The judged body is the video DESCRIPTION, verbatim — never altered. The
 * TITLE is the operator's `youtube.title` setting, or the body's first line
 * clamped to the platform's 100 (the Reddit derivation: an excerpt of
 * approved content, never new words). The made-for-kids declaration is a
 * compliance flag and is REQUIRED: an upload with no explicit declaration
 * refuses typed rather than defaulting either way.
 */

export const YOUTUBE_API_VERSION = "v3";

const TITLE_MAX = 100;
const DESCRIPTION_MAX_BYTES = 5000;

/** The one field an upload NEEDS from the platform — the accepted video id. */
const videoResourceSchema = z.object({ id: z.string().min(1) }).loose();

/** The driver's slice of the settings pass-through (door D1 seam; the D3 `youtube` block rides the same shape). */
const settingsSchema = z
  .object({
    title: z.string().min(1).optional(),
    madeForKids: z.boolean().optional(),
    privacy: z.enum(["public", "unlisted", "private"]).optional(),
  })
  .loose();

/** A post with no video cannot land on YouTube — the fit gate refuses these upstream; the driver is the structural backstop. */
export class YouTubeVideoRequiredError extends SocialDriverApiError {
  constructor(carried: string) {
    super(
      "youtube",
      0,
      `the YouTube driver publishes videos and this post carries ${carried} — a video/* attachment is the medium, and nothing else can satisfy it`,
    );
    this.name = "YouTubeVideoRequiredError";
  }
}

/** Anything beside the one video (a thumbnail image, a second video) is refused rather than silently dropped. */
export class YouTubeExtraMediaUnsupportedError extends SocialDriverApiError {
  constructor() {
    super(
      "youtube",
      0,
      "the YouTube driver uploads exactly one video — a custom thumbnail (thumbnails.set) is a later reviewed change, and extra attachments stay unpublished rather than silently dropped (the Instagram doctrine: dropping media publishes a different post than the operator approved)",
    );
    this.name = "YouTubeExtraMediaUnsupportedError";
  }
}

/** The COPPA declaration is required and never inferred — an undeclared upload refuses before any network call. */
export class YouTubeMadeForKidsUndeclaredError extends SocialDriverApiError {
  constructor() {
    super(
      "youtube",
      0,
      'YouTube requires the made-for-kids (COPPA) declaration on every upload and this post carries none — set the youtube settings\' "madeForKids" to true or false; the driver will never default a compliance declaration',
    );
    this.name = "YouTubeMadeForKidsUndeclaredError";
  }
}

export interface YouTubeDriverConfig {
  accessToken: string;
  /** API base — swappable for a test double (both the session POST and the byte PUT resolve under it in tests). */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  sleep?: Sleeper;
}

/** title = the body's first line clamped to the platform's 100 — an excerpt of approved content, never new words. */
export function youtubeDerivedTitle(text: string): string {
  const firstBreak = text.indexOf("\n");
  const firstLine = (firstBreak === -1 ? text : text.slice(0, firstBreak)).trim();
  if (firstLine.length > TITLE_MAX) {
    return `${firstLine.slice(0, TITLE_MAX - 1)}…`;
  }
  return firstLine;
}

/** `image/jpeg; charset=binary` → `image/jpeg` (the fit validator's normalisation, applied to the video split). */
function baseContentType(contentType: string): string {
  return contentType.split(";", 1)[0].trim().toLowerCase();
}

export function createYouTubeDriver(config: YouTubeDriverConfig): SocialPublisher {
  const baseUrl = (config.baseUrl ?? "https://www.googleapis.com").replace(/\/$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  return {
    platform: "youtube",
    name: "youtube-videos-insert",
    async publish(input: SocialPostInput): Promise<SocialPublishReceipt> {
      const media = input.media ?? [];
      const video = media.find((m) => baseContentType(m.contentType).startsWith("video/"));
      if (!video) {
        throw new YouTubeVideoRequiredError(
          media.length === 0 ? "no media at all" : "no video attachment",
        );
      }
      if (media.length > 1) {
        throw new YouTubeExtraMediaUnsupportedError();
      }

      // The reddit convention: a malformed settings block reads as NO
      // settings — which here fails safe, because no settings means no
      // made-for-kids declaration, and that refuses loudly below.
      const parsed = settingsSchema.safeParse(input.settings ?? {});
      const settings = parsed.success ? parsed.data : {};
      if (settings.madeForKids === undefined) {
        throw new YouTubeMadeForKidsUndeclaredError();
      }

      const title = settings.title ?? youtubeDerivedTitle(input.text);
      if (title.length > TITLE_MAX) {
        throw new SocialDriverApiError(
          "youtube",
          0,
          `the configured title is ${title.length} characters and YouTube accepts ${TITLE_MAX} — shorten the youtube settings' "title"`,
        );
      }
      // The platform bars `<` and `>` from both fields (docs.videos:
      // "may contain all valid UTF-8 characters except < and >") — a
      // deterministic pre-call refusal beats spending the upload to learn it,
      // and stripping them would publish words the operator never approved.
      for (const [field, value] of [
        ["title", title],
        ["description", input.text],
      ] as const) {
        if (/[<>]/.test(value)) {
          throw new SocialDriverApiError(
            "youtube",
            0,
            `YouTube refuses "<" and ">" in a video ${field} and this post's ${field} contains one — edit the ${field === "title" ? 'youtube settings\' "title" (or the body\'s first line)' : "body"}; the driver never rewrites approved words`,
          );
        }
      }
      // The 5000 ceiling is BYTES (the capability row's stated nuance) — the
      // fit gate counts characters, so this is the byte-accurate backstop.
      const descriptionBytes = Buffer.byteLength(input.text, "utf8");
      if (descriptionBytes > DESCRIPTION_MAX_BYTES) {
        throw new SocialDriverApiError(
          "youtube",
          0,
          `the description is ${descriptionBytes} bytes and YouTube accepts ${DESCRIPTION_MAX_BYTES} (bytes, not characters — multi-byte text bills higher than its length) — shorten the body`,
        );
      }

      // 1. Open the resumable session: POST the metadata; the upload URL
      // arrives in the Location header.
      const session = await hardenedPlatformFetch(
        "youtube",
        fetchImpl,
        `${baseUrl}/upload/youtube/${YOUTUBE_API_VERSION}/videos?uploadType=resumable&part=snippet,status`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": video.contentType,
            "X-Upload-Content-Length": String(video.bytes.length),
          },
          body: JSON.stringify({
            snippet: { title, description: input.text },
            status: {
              selfDeclaredMadeForKids: settings.madeForKids,
              ...(settings.privacy ? { privacyStatus: settings.privacy } : {}),
            },
          }),
        },
        { sleep: config.sleep },
      );
      const uploadUrl = session.headers.get("location");
      if (!uploadUrl) {
        throw new SocialDriverApiError(
          "youtube",
          session.status,
          "resumable session opened without a Location upload URL — nothing provably started",
        );
      }

      // 2. The bytes. One shot: the door holds the whole file in memory
      // already, so chunked resume adds states without adding safety here.
      const uploaded = await hardenedPlatformFetch(
        "youtube",
        fetchImpl,
        uploadUrl,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": video.contentType,
          },
          body: new Uint8Array(video.bytes),
        },
        { sleep: config.sleep },
      );
      const resource = videoResourceSchema.safeParse(await responseJson(uploaded));
      if (!resource.success) {
        throw new SocialDriverApiError(
          "youtube",
          uploaded.status,
          "2xx upload response without a video id — refusing to treat as posted",
        );
      }
      return {
        externalPostId: resource.data.id,
        meta: {
          permalink: `https://www.youtube.com/watch?v=${resource.data.id}`,
          apiVersion: YOUTUBE_API_VERSION,
          madeForKids: settings.madeForKids,
          ...(settings.privacy ? { privacy: settings.privacy } : {}),
        },
      };
    },
  };
}
