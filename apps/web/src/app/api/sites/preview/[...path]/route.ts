import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  PREVIEW_CACHE_CONTROL,
  contentTypeFor,
  hasExtension,
  safePreviewSegments,
} from "@/lib/sites/preview";
import { resolvePreviewUpstream } from "@/lib/sites/provider";

/**
 * The site-preview door (B-sites.1, s76) — the workspace serves the
 * portfolio's own bytes, SAME-ORIGIN, so a viewer who is not on the box sees
 * the thumbnails and the dossier preview exactly as the box does.
 *
 * It is the one route behind `PREVIEW_BASE`, and it reads whichever upstream
 * `loadSites` reads (lib/sites/provider `resolvePreviewUpstream`): the local
 * template directory in dev, the configured origin on staging/prod. No
 * per-viewer environment, no absolute origin baked into any HTML.
 *
 * Fail-closed, in three independent layers:
 *  1. the workspace gate — `/api/…` is not on the public allowlist
 *     (lib/auth/gate.ts), so previews stay behind the stealth posture;
 *  2. path containment — segments are validated (no `..`, no embedded
 *     separators, both already percent-decoded by Next) AND the resolved
 *     path is proven to sit under the root before anything is read;
 *  3. a CLOSED content-type set — an extension the portfolio does not ship
 *     is a 404, so this can never be talked into serving something else that
 *     happens to sit in the tree.
 *
 * It is a media door, not a general proxy: nothing from the incoming request
 * is forwarded upstream, and the response type comes from OUR map plus
 * `nosniff` rather than from whatever the upstream claimed.
 */

export const dynamic = "force-dynamic";

function notFound(): Response {
  return new Response("Not Found", { status: 404 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  const segments = safePreviewSegments((await params).path ?? []);
  if (!segments) return notFound();

  const last = segments[segments.length - 1];
  if (!hasExtension(last)) {
    // A page, asked for as a directory. Redirect to its canonical document
    // URL so the page's OWN relative links (`assets/…`, and the guide's
    // `../fonts/…`) resolve against the directory it lives in — Next strips
    // a trailing slash before a route handler ever runs, so the slash cannot
    // do that job here.
    const url = new URL(request.url);
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/index.html`;
    url.search = "";
    return Response.redirect(url, 308);
  }
  const contentType = contentTypeFor(last);
  if (!contentType) return notFound();

  const upstream = resolvePreviewUpstream();
  if (upstream.kind === "unconfigured") {
    // A missing setting, said out loud — never an empty-looking 404 that
    // reads as "this site has no media".
    return new Response("no sites origin is configured", { status: 503 });
  }
  return upstream.kind === "dir"
    ? serveFromDir(request, upstream.dir, segments, contentType)
    : serveFromOrigin(upstream.origin, segments, contentType);
}

async function serveFromDir(
  request: Request,
  dir: string,
  segments: string[],
  contentType: string,
): Promise<Response> {
  const root = path.resolve(dir);
  const resolved = path.resolve(root, ...segments);
  // Belt and braces: the segment guard already forbids `..`, and this proves
  // containment of whatever survived it (symlink-free by construction — the
  // template tree is plain files).
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return notFound();

  let info;
  try {
    info = await stat(resolved);
  } catch {
    return notFound();
  }
  if (!info.isFile()) return notFound();

  const etag = `W/"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
  const revalidation = { etag, "cache-control": PREVIEW_CACHE_CONTROL };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: revalidation });
  }

  const bytes = await readFile(resolved);
  // Copying constructor: BodyInit wants an ArrayBuffer-backed view, and a
  // view over `bytes.buffer` stays ArrayBufferLike-typed (the s71 catch).
  return new Response(new Uint8Array(bytes), {
    headers: {
      ...revalidation,
      "content-type": contentType,
      "content-length": String(bytes.byteLength),
      "x-content-type-options": "nosniff",
    },
  });
}

async function serveFromOrigin(
  origin: string,
  segments: string[],
  contentType: string,
): Promise<Response> {
  const target = `${origin}/${segments.join("/")}`;
  let upstream: Response;
  try {
    upstream = await fetch(target, { cache: "no-store", redirect: "follow" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sites origin unreachable";
    return new Response(`sites origin unreachable: ${message}`, { status: 502 });
  }
  if (upstream.status === 404) return notFound();
  if (!upstream.ok) {
    return new Response(`sites origin answered ${upstream.status}`, { status: 502 });
  }
  return new Response(await upstream.arrayBuffer(), {
    headers: {
      "content-type": contentType,
      "cache-control": upstream.headers.get("cache-control") ?? PREVIEW_CACHE_CONTROL,
      "x-content-type-options": "nosniff",
    },
  });
}
