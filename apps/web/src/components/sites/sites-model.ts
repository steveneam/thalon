import type { SiteRecord, SiteVerdictStatus } from "@/lib/sites/catalog";

/**
 * Pure math for the Sites surface (the exact-mock rebuild of Sites.dc.html).
 * Filters are derived from the catalog itself — vertical/axis/wave
 * vocabularies are whatever the records carry, never hard-coded (the same
 * column-as-field-value instinct as the leads board); the surface only
 * renders what these return.
 */

export interface SiteFilters {
  vertical?: string;
  axis?: string;
  wave?: number;
}

/** The verdict chip vocabulary — picked once, worn everywhere (Q3). */
export const VERDICT_WORDS: Record<SiteVerdictStatus, string> = {
  approved: "Approved",
  "fix-round": "Fix round",
  awaiting: "Awaiting verdict",
};

/** The sheet's pill channel per verdict — the state word never softens to fit the fixture. */
export const VERDICT_PILL: Record<SiteVerdictStatus, string> = {
  approved: "pill pill-ok",
  "fix-round": "pill pill-warn",
  awaiting: "pill pill-idle",
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

/**
 * One chip in the sheet's "Or start from the portfolio —" row. The sheet's
 * fixture chips are a curated vocabulary ("Café · warm") the catalog does
 * not carry, so the labels are the catalog's OWN values, humanized: a
 * vertical keeps its family/speciality split in the sheet's `·` grammar, an
 * axis is the register it names, a wave is the build wave it shipped in.
 */
export interface SiteChip {
  kind: "vertical" | "axis" | "wave";
  value: string;
  label: string;
}

/** "trade-electrician" → "Trade · electrician" — the catalog's own value, read out loud. */
export function verticalLabel(vertical: string): string {
  const [family, ...rest] = vertical.split("-");
  const head = family.charAt(0).toUpperCase() + family.slice(1);
  return rest.length > 0 ? `${head} · ${rest.join(" ")}` : head;
}

/** "high-quality-3d" → "High quality 3d" — the design register, spelled out. */
export function axisLabel(axis: string): string {
  const words = axis.split("-").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The chip row, in the order the surface shows it: verticals first (most
 * built first — the portfolio's own weight), then the design registers, then
 * the build waves. The surface shows the first PRIMARY_CHIPS and hides the
 * rest behind the sheet's own "More →" chip.
 */
export function siteChips(records: SiteRecord[]): SiteChip[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    if (r.vertical) counts.set(r.vertical, (counts.get(r.vertical) ?? 0) + 1);
  }
  const facets = facetValues(records);
  const verticals = facets.verticals
    .slice()
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b))
    .map((value): SiteChip => ({ kind: "vertical", value, label: verticalLabel(value) }));
  const axes = facets.axes.map((value): SiteChip => ({ kind: "axis", value, label: axisLabel(value) }));
  const waves = facets.waves.map(
    (value): SiteChip => ({ kind: "wave", value: String(value), label: `Wave ${value}` }),
  );
  return [...verticals, ...axes, ...waves];
}

/** How many chips rest in the row before "More →" — the sheet draws five. */
export const PRIMARY_CHIPS = 5;

/** True when this chip is the active filter — one filter per kind, exactly like the old facet rows. */
export function chipActive(chip: SiteChip, filters: SiteFilters): boolean {
  if (chip.kind === "vertical") return filters.vertical === chip.value;
  if (chip.kind === "axis") return filters.axis === chip.value;
  return filters.wave !== undefined && String(filters.wave) === chip.value;
}

/** Toggling a chip sets or clears its own kind — the other kinds keep their picks. */
export function toggleChip(chip: SiteChip, filters: SiteFilters): SiteFilters {
  if (chip.kind === "vertical") {
    return { ...filters, vertical: filters.vertical === chip.value ? undefined : chip.value };
  }
  if (chip.kind === "axis") {
    return { ...filters, axis: filters.axis === chip.value ? undefined : chip.value };
  }
  const wave = Number(chip.value);
  return { ...filters, wave: filters.wave === wave ? undefined : wave };
}

/**
 * The headline pills. The sheet's fixture reads "17 built · 2 live"; the
 * catalog carries no deploy state, so the second pill states what the
 * portfolio actually records — how many carry the founder's approval. A
 * filter never hides the total (Bounded-List: counts stated, nothing hidden
 * silently).
 */
export function headerPills(
  all: SiteRecord[],
  shown: SiteRecord[],
): { built: string; approved: string } {
  const approved = all.filter((r) => verdictStatus(r) === "approved").length;
  return {
    built: shown.length === all.length ? `${all.length} built` : `${shown.length} of ${all.length} built`,
    approved: `${approved} approved`,
  };
}
