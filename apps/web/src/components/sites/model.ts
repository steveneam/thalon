import type { SiteRecord, SiteVerdictStatus } from "@/lib/sites/catalog";

/**
 * Pure math for the Sites gallery (W-sites, s61). Filters are derived from
 * the catalog itself — vertical/axis/wave vocabularies are whatever the
 * records carry, never hard-coded (the same column-as-field-value instinct
 * as the leads board).
 */

export interface SiteFilters {
  vertical?: string;
  axis?: string;
  wave?: number;
}

/** The verdict chip vocabulary — picked once, worn everywhere (Q3). */
export const VERDICT_WORDS: Record<SiteVerdictStatus, string> = {
  approved: "approved",
  "fix-round": "fix round",
  awaiting: "awaiting verdict",
};

/** A site with no verdict field is awaiting by definition — honesty defaults down, never up. */
export function verdictStatus(site: SiteRecord): SiteVerdictStatus {
  return site.verdict?.status ?? "awaiting";
}

export function applyFilters(records: SiteRecord[], f: SiteFilters): SiteRecord[] {
  return records.filter(
    (r) =>
      (!f.vertical || r.vertical === f.vertical) &&
      (!f.axis || r.axes.primary === f.axis || r.axes.secondary === f.axis) &&
      (f.wave === undefined || r.wave === f.wave),
  );
}

export function facetValues(records: SiteRecord[]): {
  verticals: string[];
  axes: string[];
  waves: number[];
} {
  const verticals = [...new Set(records.map((r) => r.vertical).filter(Boolean))].sort();
  const axes = [
    ...new Set(records.flatMap((r) => [r.axes.primary, r.axes.secondary ?? ""]).filter(Boolean)),
  ].sort();
  const waves = [...new Set(records.map((r) => r.wave).filter((w): w is number => w !== undefined))].sort(
    (a, b) => a - b,
  );
  return { verticals, axes, waves };
}

/** The count line always states the whole truth: total, filtered, approved (Bounded-List: counts stated, nothing hidden silently). */
export function countLine(all: SiteRecord[], shown: SiteRecord[]): string {
  const approved = all.filter((r) => verdictStatus(r) === "approved").length;
  const filtered = shown.length === all.length ? "" : `${shown.length} shown · `;
  return `${filtered}${all.length} sites · ${approved} approved`;
}
