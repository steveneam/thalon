import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { assembleSiteRecord, parseCatalog, type SiteRecord } from "./catalog";

/**
 * W-sites (s61): the ONE read seam between the workspace and wherever the
 * portfolio actually lives. Two sources, honest states for the rest:
 *
 * - `SITES_BASE_URL` set (staging/prod): fetch `<base>/catalog.json` from
 *   the templates image, server-side (no browser CORS surface). The same
 *   base is the iframe/preview origin.
 * - else, the local template dir exists (dev on the repo): assemble the
 *   catalog straight from `site.json` + manifests; preview origin is the
 *   8899 no-cache server (`SITES_PREVIEW_ORIGIN` overrides).
 * - else: `unconfigured` — the surface states it plainly, never a fake
 *   empty gallery.
 *
 * This seam is where a real tenant's generated sites plug in later (the
 * future `sites` table rides its own contract window) — v1 is explicitly
 * the self/demo tenant, read-only.
 */

export type SitesSource =
  | { kind: "local" | "remote"; records: SiteRecord[]; previewOrigin: string }
  | { kind: "unconfigured" }
  | { kind: "error"; message: string };

const LOCAL_SITES_DIR = path.resolve(process.cwd(), "../../proprietary/templates/sites");
const DEV_PREVIEW_ORIGIN = "http://127.0.0.1:8899";

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
      return { kind: "remote", records: parseCatalog(await res.json()), previewOrigin: base };
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
      previewOrigin: process.env.SITES_PREVIEW_ORIGIN ?? DEV_PREVIEW_ORIGIN,
    };
  }
  return { kind: "unconfigured" };
}
