import { parsePublicAssetName, readPublicAssetBytes } from "@thalon/engine";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * B-pub.4: the public image door — `/assets/<sha256>.<ext>` serves
 * content-addressed bytes from the pin store, gated by the tenant's
 * public-asset allowlist (engine webpage/public-assets.ts): ONLY refs a
 * currently-published artifact references are servable; everything else —
 * malformed names, unlisted refs, unknown extensions — is an anonymous 404
 * with zero asset-store probes. No enumeration exists (nothing lists), and
 * a tampered object refuses loudly (ContentAddressMismatchError → 500)
 * rather than serving corrupt bytes.
 *
 * This path is on the auth gate's public allowlist (lib/auth/gate.ts) on
 * purpose: it is the strategic IG/Threads unlock — both platforms fetch a
 * public `image_url` anonymously and never accept uploaded bytes. Content
 * is immutable by construction (the hash IS the name), so the cache policy
 * is a year + immutable.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string }> },
): Promise<Response> {
  const { asset } = await params;
  const ref = parsePublicAssetName(asset);
  if (!ref) return new Response("Not Found", { status: 404 });

  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return new Response("Not Found", { status: 404 });

  const result = await readPublicAssetBytes(ctx.tenantId, ref);
  if (result.status === "not_public") return new Response("Not Found", { status: 404 });
  if (result.status === "missing") {
    // Allowlisted but the pinned bytes are gone: an operator-side integrity
    // break (assets/ is sweep-protected), never a quiet 404.
    return new Response("published asset is missing from the object store", { status: 503 });
  }

  const { bytes, contentType } = result;
  return new Response(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), {
    headers: {
      "content-type": contentType,
      "content-length": String(bytes.byteLength),
      // Content-addressed → immutable: the URL can never serve different bytes.
      "cache-control": "public, max-age=31536000, immutable",
      // The ext→content-type map is a closed set; never let a browser second-guess it.
      "x-content-type-options": "nosniff",
    },
  });
}
