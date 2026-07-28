import { z } from "zod";
import type { SocialPostInput, SocialPublisher, SocialPublishReceipt } from "../registry";
import {
  hardenedPlatformFetch,
  responseJson,
  SocialDriverApiError,
  type Sleeper,
} from "./errors";

/**
 * D1 (s83): the Bluesky driver — raw AT-Protocol XRPC over the hardened
 * platform fetch (ADR 0002: official platform APIs only). Auth is the
 * platform's own designed app-password session: `createSession` yields a
 * short-lived accessJwt per publish — no stored session state, the
 * LinkedIn stateless convention. A revoked app password surfaces as the
 * hardened fetch's 401 → typed refresh signal, which for this flavor means
 * RECONNECT (app passwords don't refresh; the card says so).
 *
 * Deliberate deviation from the prior-art TAKE (@atproto/api, MIT): the SDK
 * owns its own transport, which would bury the injectable-fetch seam every
 * driver test relies on. Raw XRPC keeps the seam; LINK facets are computed
 * deterministically here (URL spans by UTF-8 byte offset — pure code);
 * MENTION resolution (handle → DID lookups) is deferred to D3 with the SDK
 * as the recorded swap path when that lands. Until then a mention posts as
 * plain text — stated, not hidden.
 */

const SERVICE_DEFAULT = "https://bsky.social";

const sessionSchema = z
  .object({ accessJwt: z.string().min(1), did: z.string().min(1), handle: z.string().optional() })
  .loose();

const blobSchema = z.object({ blob: z.unknown() }).loose();

const createRecordSchema = z.object({ uri: z.string().min(1), cid: z.string().min(1) }).loose();

export interface BlueskyDriverConfig {
  /** The app password (rides the SOCIAL_BLUESKY_ACCESS_TOKEN seat — the seat holds the platform's own secret shape). */
  appPassword: string;
  /** Handle or DID of the connected account. */
  identifier: string;
  service?: string;
  fetchImpl?: typeof fetch;
  sleep?: Sleeper;
  /** Record timestamp source — injectable for deterministic tests. */
  clock?: () => Date;
}

/**
 * app.bsky.richtext.facet#link spans for every URL in the text, indexed by
 * UTF-8 BYTE offset (the protocol's requirement — a code-point index would
 * shift under any non-ASCII character before the link).
 */
export function blueskyLinkFacets(text: string): Array<Record<string, unknown>> {
  const facets: Array<Record<string, unknown>> = [];
  const pattern = /https?:\/\/[^\s]+/g;
  for (const match of text.matchAll(pattern)) {
    // Trailing punctuation reads as prose, not address — trim it off the span.
    const uri = match[0].replace(/[.,;:!?)\]]+$/, "");
    if (uri.length === 0) continue;
    const byteStart = Buffer.byteLength(text.slice(0, match.index), "utf8");
    const byteEnd = byteStart + Buffer.byteLength(uri, "utf8");
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: "app.bsky.richtext.facet#link", uri }],
    });
  }
  return facets;
}

export function createBlueskyDriver(config: BlueskyDriverConfig): SocialPublisher {
  const service = (config.service ?? SERVICE_DEFAULT).replace(/\/$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  const clock = config.clock ?? (() => new Date());
  const xrpc = (method: string) => `${service}/xrpc/${method}`;
  return {
    platform: "bluesky",
    name: "bluesky-post",
    async publish(input: SocialPostInput): Promise<SocialPublishReceipt> {
      // 1. The platform's own auth: identifier + app password → session.
      const sessionRes = await hardenedPlatformFetch(
        "bluesky",
        fetchImpl,
        xrpc("com.atproto.server.createSession"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: config.identifier, password: config.appPassword }),
        },
        { sleep: config.sleep },
      );
      const session = sessionSchema.safeParse(await responseJson(sessionRes));
      if (!session.success) {
        throw new SocialDriverApiError(
          "bluesky",
          sessionRes.status,
          "createSession answered without accessJwt/did — cannot author the record",
        );
      }
      const authed = { Authorization: `Bearer ${session.data.accessJwt}` };

      // 2. Media leg: each image uploads as a blob, then embeds. The door
      // caps refs at one today; the loop is the honest shape regardless.
      const images: Array<Record<string, unknown>> = [];
      for (const item of input.media ?? []) {
        const uploadRes = await hardenedPlatformFetch(
          "bluesky",
          fetchImpl,
          xrpc("com.atproto.repo.uploadBlob"),
          {
            method: "POST",
            headers: { ...authed, "Content-Type": item.contentType },
            // A plain Uint8Array satisfies BodyInit under both the DOM lib
            // and the engine's minimal ambient fetch; Buffer does not.
            body: new Uint8Array(item.bytes),
          },
          { sleep: config.sleep },
        );
        const uploaded = blobSchema.safeParse(await responseJson(uploadRes));
        if (!uploaded.success || uploaded.data.blob === undefined) {
          throw new SocialDriverApiError(
            "bluesky",
            uploadRes.status,
            "uploadBlob answered without a blob ref — the image did not land",
          );
        }
        images.push({ image: uploaded.data.blob, alt: item.altText ?? "" });
      }

      // 3. The post record — judged body verbatim, links as facets.
      const facets = blueskyLinkFacets(input.text);
      const record: Record<string, unknown> = {
        $type: "app.bsky.feed.post",
        text: input.text,
        createdAt: clock().toISOString(),
        ...(facets.length > 0 ? { facets } : {}),
        ...(images.length > 0
          ? { embed: { $type: "app.bsky.embed.images", images } }
          : {}),
      };
      const createRes = await hardenedPlatformFetch(
        "bluesky",
        fetchImpl,
        xrpc("com.atproto.repo.createRecord"),
        {
          method: "POST",
          headers: { ...authed, "Content-Type": "application/json" },
          body: JSON.stringify({
            repo: session.data.did,
            collection: "app.bsky.feed.post",
            record,
          }),
        },
        { sleep: config.sleep },
      );
      const created = createRecordSchema.safeParse(await responseJson(createRes));
      if (!created.success) {
        throw new SocialDriverApiError(
          "bluesky",
          createRes.status,
          "createRecord answered without uri/cid — nothing provably landed",
        );
      }
      return {
        externalPostId: created.data.uri,
        meta: {
          cid: created.data.cid,
          ...(session.data.handle ? { author: `@${session.data.handle}` } : {}),
        },
      };
    },
  };
}
