/**
 * W-sites (s61): the sites catalog — the ONE record shape the workspace
 * reads, wherever it came from (dev: assembled from the local template dir;
 * staging/prod: fetched as /catalog.json from the templates image, which
 * assembles it with scripts/build-sites-catalog.mjs at image build).
 *
 * Deliberately dependency-free (no "@/" imports): scripts and server code
 * both lean on it. parseCatalog is the drift guard between the two
 * assemblers — whatever built the JSON, it must parse HERE.
 */

export const SITE_VERDICT_STATUSES = ["approved", "fix-round", "awaiting"] as const;
export type SiteVerdictStatus = (typeof SITE_VERDICT_STATUSES)[number];

export interface SiteVerdict {
  status: SiteVerdictStatus;
  note?: string;
  at?: string;
}

export interface SiteAssetFact {
  file: string;
  width: number;
  height: number;
  /** Last 8 hex of the pinned original's content hash — the provenance pointer, human-scale. */
  hashTail: string;
}

export interface SiteRecord {
  slug: string;
  name: string;
  vertical: string;
  oneLiner: string;
  axes: { primary: string; secondary?: string };
  axisNote?: string;
  paletteSeed?: string;
  typeDirection?: string;
  motionBudget?: string;
  wave?: number;
  built?: string;
  verdict?: SiteVerdict;
  /** Path under the sites origin, e.g. "sparkwright/assets/hero-dusk.webp". */
  cardImage?: string;
  assets: SiteAssetFact[];
}

interface RawManifestEntry {
  file?: unknown;
  pinnedHash?: unknown;
  width?: unknown;
  height?: unknown;
}

/** Assemble one record from a site.json object + its manifest array (dev-side assembler; the image-side twin is scripts/build-sites-catalog.mjs). */
export function assembleSiteRecord(siteJson: unknown, manifest: unknown): SiteRecord | null {
  if (typeof siteJson !== "object" || siteJson === null) return null;
  const s = siteJson as Record<string, unknown>;
  if (typeof s.slug !== "string" || typeof s.name !== "string") return null;
  const axes = (s.axes ?? {}) as Record<string, unknown>;
  const entries: RawManifestEntry[] = Array.isArray(manifest) ? (manifest as RawManifestEntry[]) : [];
  const assets: SiteAssetFact[] = entries
    .filter((e) => typeof e.file === "string" && typeof e.pinnedHash === "string")
    .map((e) => ({
      file: e.file as string,
      width: typeof e.width === "number" ? e.width : 0,
      height: typeof e.height === "number" ? e.height : 0,
      hashTail: (e.pinnedHash as string).slice(-8),
    }));
  const cardFile =
    typeof s.cardImage === "string" ? s.cardImage : (assets[0]?.file ?? undefined);
  const verdict =
    typeof s.verdict === "object" && s.verdict !== null ? (s.verdict as SiteVerdict) : undefined;
  return {
    slug: s.slug,
    name: s.name,
    vertical: typeof s.vertical === "string" ? s.vertical : "",
    oneLiner: typeof s.oneLiner === "string" ? s.oneLiner : "",
    axes: {
      primary: typeof axes.primary === "string" ? axes.primary : "",
      secondary: typeof axes.secondary === "string" ? axes.secondary : undefined,
    },
    axisNote: typeof s.axisNote === "string" ? s.axisNote : undefined,
    paletteSeed: typeof s.paletteSeed === "string" ? s.paletteSeed : undefined,
    typeDirection: typeof s.typeDirection === "string" ? s.typeDirection : undefined,
    motionBudget: typeof s.motionBudget === "string" ? s.motionBudget : undefined,
    wave: typeof s.wave === "number" ? s.wave : undefined,
    built: typeof s.built === "string" ? s.built : undefined,
    verdict:
      verdict && SITE_VERDICT_STATUSES.includes(verdict.status) ? verdict : undefined,
    cardImage: cardFile ? `${s.slug}/assets/${cardFile}` : undefined,
    assets,
  };
}

/** Validate a fetched/assembled catalog. Throws on structural garbage; filters records that don't parse (never renders half a record). */
export function parseCatalog(json: unknown): SiteRecord[] {
  if (!Array.isArray(json)) throw new Error("catalog is not an array");
  const out: SiteRecord[] = [];
  for (const item of json) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.slug !== "string" || typeof r.name !== "string") continue;
    // Round-trip through the assembler: one validation path for both sources.
    const record = assembleSiteRecord(
      { ...r, cardImage: undefined },
      undefined,
    );
    if (!record) continue;
    record.assets = Array.isArray(r.assets)
      ? (r.assets as SiteAssetFact[]).filter(
          (a) => typeof a.file === "string" && typeof a.hashTail === "string",
        )
      : [];
    record.cardImage = typeof r.cardImage === "string" ? r.cardImage : undefined;
    out.push(record);
  }
  return out.sort((a, b) => (b.built ?? "").localeCompare(a.built ?? "") || a.slug.localeCompare(b.slug));
}
