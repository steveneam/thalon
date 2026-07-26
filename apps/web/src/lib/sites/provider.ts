import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { assembleSiteRecord, parseCatalog, type SiteRecord } from "./catalog";

/**
 * W-sites (s61): the ONE read seam between the workspace and wherever the
 * portfolio actually lives. Two sources, honest states for the rest:
 *
 * - `SITES_BASE_URL` set (staging/prod): fetch `<base>/catalog.json` from
 *   the templates image, server-side (no browser CORS surface). The same
 *   base is where the preview route fetches media from.
 * - else, the local template dir exists (dev on the repo): assemble the
 *   catalog straight from `site.json` + manifests; the preview route reads
 *   the same directory (`SITES_PREVIEW_ORIGIN` overrides it with an HTTP
 *   origin — e.g. the 8899 no-cache server — for anyone who wants that).
 * - else: `unconfigured` — the surface states it plainly, never a fake
 *   empty gallery.
 *
 * PREVIEW MEDIA IS SAME-ORIGIN (s76). The record carries where the bytes
 * come FROM, for the visible-provenance line; it no longer carries an origin
 * for the browser to resolve against, because a browser origin that is right
 * on the box is wrong on every other machine. See lib/sites/preview.ts.
 *
 * This seam is where a real tenant's generated sites plug in later (the
 * future `sites` table rides its own contract window) — v1 is explicitly
 * the self/demo tenant, read-only.
 */

export type SitesSource =
  | {
      kind: "local" | "remote";
      records: SiteRecord[];
      /** Human-readable: where the preview bytes actually come from. */
      previewUpstream: string;
    }
  | { kind: "unconfigured" }
  | { kind: "error"; message: string };

const LOCAL_SITES_DIR = path.resolve(process.cwd(), "../../proprietary/templates/sites");

/** Where the preview route gets its bytes — the same two sources loadSites reads. */
export type PreviewUpstream =
  | { kind: "dir"; dir: string }
  | { kind: "origin"; origin: string }
  | { kind: "unconfigured" };

/**
 * The upstream decision, as PURE string logic — the same split
 * `lib/auth/gate.ts` uses, and for the same reason: the resolver below reads
 * `process.cwd()` and the filesystem, so the rule itself has to be testable
 * without either. (Learned the hard way: a test that assumed the local dir
 * resolves passed alone and failed under the root runner, which has a
 * different cwd.)
 *
 * Precedence is unchanged from s61. Note the override is deliberately INSIDE
 * the local branch: with no base URL and no local tree there is no catalog
 * either, so `unconfigured` is the consistent answer — the surface says the
 * setting is missing rather than serving previews for a portfolio it cannot
 * list.
 */
export function chooseUpstream(
  // A read of the environment, not a shape: `process.env` is an index
  // signature, and naming only the two keys makes it a weak type TS refuses
  // to accept it into.
  env: Record<string, string | undefined>,
  localDir: string,
  localDirExists: boolean,
): PreviewUpstream {
  const base = env.SITES_BASE_URL?.replace(/\/$/, "");
  if (base) return { kind: "origin", origin: base };
  if (localDirExists) {
    const override = env.SITES_PREVIEW_ORIGIN?.replace(/\/$/, "");
    return override ? { kind: "origin", origin: override } : { kind: "dir", dir: localDir };
  }
  return { kind: "unconfigured" };
}

/**
 * The ONE upstream decision, shared by the catalog read and the preview
 * route so the two can never disagree about which portfolio is being served.
 */
export function resolvePreviewUpstream(): PreviewUpstream {
  return chooseUpstream(process.env, LOCAL_SITES_DIR, existsSync(LOCAL_SITES_DIR));
}

/** The provenance line's words for an upstream — what is TRUE, never a guess. */
export function upstreamLabel(upstream: PreviewUpstream): string {
  if (upstream.kind === "dir") return "the local template directory";
  if (upstream.kind === "origin") return upstream.origin;
  return "no origin configured";
}

function readLocal(): SiteRecord[] {
  const records: SiteRecord[] = [];
  for (const slug of readdirSync(LOCAL_SITES_DIR).sort()) {
    const dir = path.join(LOCAL_SITES_DIR, slug);
    if (!statSync(dir).isDirectory()) continue;
    let site: unknown;
    try {
      site = JSON.parse(readFileSync(path.join(dir, "site.json"), "utf8"));
    } catch {
      continue;
    }
    let manifest: unknown;
    try {
      manifest = JSON.parse(readFileSync(path.join(dir, "assets", "manifest.json"), "utf8"));
    } catch {
      manifest = [];
    }
    const record = assembleSiteRecord(site, manifest);
    if (record) records.push(record);
  }
  return records.sort(
    (a, b) => (b.built ?? "").localeCompare(a.built ?? "") || a.slug.localeCompare(b.slug),
  );
}

export async function loadSites(): Promise<SitesSource> {
  const base = process.env.SITES_BASE_URL?.replace(/\/$/, "");
  if (base) {
    try {
      const res = await fetch(`${base}/catalog.json`, { cache: "no-store" });
      if (!res.ok) return { kind: "error", message: `sites origin answered ${res.status}` };
      return { kind: "remote", records: parseCatalog(await res.json()), previewUpstream: base };
    } catch (err) {
      return {
        kind: "error",
        message: err instanceof Error ? err.message : "sites origin unreachable",
      };
    }
  }
  if (existsSync(LOCAL_SITES_DIR)) {
    return {
      kind: "local",
      records: readLocal(),
      previewUpstream: upstreamLabel(resolvePreviewUpstream()),
    };
  }
  return { kind: "unconfigured" };
}
