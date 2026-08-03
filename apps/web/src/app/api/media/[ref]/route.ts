import { MEDIA_CONTENT_TYPES, MEDIA_EXTS, type MediaExt } from "@thalon/contracts";
import { ContentAddressMismatchError, getContentAddressed, getObjectStore, objectKey } from "@thalon/platform";

/**
 * B-media.0: the WORKSPACE media door — `/api/media/<sha256>.<ext>` serves
 * content-addressed bytes we hold (derived posters today, operator uploads
 * and audio beds later) to a signed-in operator.
 *
 * This is deliberately NOT the public `/assets/<sha256>.<ext>` door. That one
 * is allowlist-gated to refs a currently-published artifact references, which
 * is exactly right for the blog/IG unlock (s71) and exactly wrong here: a
 * workspace thumbnail must never require publishing something to become
 * visible to its own operator. Two doors, two gates, one store.
 *
 * The auth gate is fail-closed by construction — `lib/auth/gate.ts` carries a
 * closed public allowlist and this path is not on it, so the route is signed-
 * in-only without opting into anything. `media-door.test.ts` pins that.
 *
 * Reads are VERIFIED: `getContentAddressed` re-hashes the bytes against the
 * key, so a tampered object refuses loudly rather than serving corrupt bytes.
 * The sha IS the version, so the cache policy is a year + immutable.
 */

export const dynamic = "force-dynamic";

/** `<sha256>.<ext>` — the same shape the public door parses, against our own closed ext set. */
export function parseMediaRef(name: string): { sha256: string; ext: MediaExt } | null {
  const match = /^([0-9a-f]{64})\.([a-z0-9]+)$/.exec(name);
  if (!match) return null;
  const [, sha256, ext] = match;
  return (MEDIA_EXTS as readonly string[]).includes(ext) ? { sha256, ext: ext as MediaExt } : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ref: string }> },
): Promise<Response> {
  const { ref } = await params;
  const parsed = parseMediaRef(ref);
  // A malformed name is an anonymous 404 with zero store probes — nothing
  // here enumerates, and a bad ext never reaches the object store.
  if (!parsed) return new Response("Not Found", { status: 404 });

  /*
   * s96 (Schedule S1) — the door now reads TWO image families: `media/`
   * (derived posters, operator uploads) and `social-media/` (a draft's own
   * attached post image — the bytes the publish door sends). Both are
   * content-addressed in the same store; the sha IS the identity, so trying
   * the second family on a first-family miss serves the same bytes the key
   * would anywhere. The families are a CLOSED list — this door never takes a
   * family from the URL, so nothing here can be steered at other prefixes.
   */
  const store = getObjectStore();
  let bytes: Buffer | null = null;
  try {
    for (const family of ["media", "social-media"]) {
      bytes = await getContentAddressed(store, objectKey(family, parsed.sha256, parsed.ext));
      if (bytes !== null) break;
    }
  } catch (error) {
    if (error instanceof ContentAddressMismatchError) {
      // The stored object no longer hashes to its own key. Serving it would
      // hand the operator bytes we cannot vouch for.
      return new Response("stored media failed its content-address check", { status: 500 });
    }
    throw error;
  }
  if (!bytes) return new Response("Not Found", { status: 404 });

  // Copying constructor on purpose: BodyInit wants an ArrayBuffer-backed view,
  // and a view over bytes.buffer stays ArrayBufferLike-typed (the s71 catch).
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": MEDIA_CONTENT_TYPES[parsed.ext],
      "content-length": String(bytes.byteLength),
      "cache-control": "private, max-age=31536000, immutable",
      // The ext→content-type map is a closed set; never let a browser guess.
      "x-content-type-options": "nosniff",
    },
  });
}
