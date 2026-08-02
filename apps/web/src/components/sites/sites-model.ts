import { SITE_VERDICT_STATUSES, type SiteRecord, type SiteVerdictStatus } from "@/lib/sites/catalog";

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
  /** The W2 seg's cut — a recorded verdict state, never an invented deploy state. */
  state?: SiteVerdictStatus;
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
      (f.wave === undefined || r.wave === f.wave) &&
      (f.state === undefined || verdictStatus(r) === f.state),
  );
}

/**
 * The h1 seg (W2 amendment: "the h1 pills became a real state filter seg").
 * The sheet's fixture reads All 17 · Live 2 · Draft 15 — a deploy-state
 * census. The catalog records no deploy state (the same fact that put the
 * VERDICT on the state pill), so the seg's vocabulary is the recorded one:
 * All, then each verdict state that has members. Counts are the whole
 * portfolio's census, like the sheet's own — a chip narrowing the grid is
 * stated by the chip itself (visibly on, s79 rule), never by re-counting
 * the census under it.
 */
export interface StateSegOption {
  state?: SiteVerdictStatus;
  label: string;
}

export function stateSeg(records: SiteRecord[]): StateSegOption[] {
  const out: StateSegOption[] = [{ label: `All ${records.length}` }];
  for (const status of SITE_VERDICT_STATUSES) {
    const n = records.filter((r) => verdictStatus(r) === status).length;
    if (n > 0) out.push({ state: status, label: `${VERDICT_WORDS[status]} ${n}` });
  }
  return out;
}

/**
 * The card's truth line (W2 amendment): a LIVE site would carry its hostname
 * — "the site's address IS its card fact" — and a draft says "previews
 * only", never a fake URL. The catalog records no deploy state and no
 * hostname, so every card today is honestly on the draft branch; the live
 * branch renders the day a deploy fact exists to render, not before.
 */
export function truthLine(site: SiteRecord): string {
  const minted = mintedStamp(site.built);
  return minted ? `previews only · minted ${minted}` : "previews only";
}

/** "2026-07-18" → "18 Jul" (the sheet's minted grammar); an unparseable date is no date. */
export function mintedStamp(built: string | undefined): string | null {
  if (!built) return null;
  const at = new Date(built);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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
 * The design registers one card states, in the sheet's `·` grammar. This is
 * the old gallery's per-card axis pair, re-entering behind the card's own
 * chrome (s76) — the values are the catalog's, never a re-derivation.
 */
export function cardFacts(site: SiteRecord): string[] {
  return [site.axes.primary, site.axes.secondary].filter((a): a is string => Boolean(a));
}

/**
 * The chip row, in the order the surface shows it: verticals first (heaviest
 * first — the portfolio's own weight, alphabetical between equals), then the
 * design registers, then the build waves. This is the EXPANDED row's reading
 * order — what it is, how it looks, when it shipped.
 *
 * The weight sort is currently a no-op and that is worth stating rather than
 * discovering twice: today's catalog is 20 sites across 20 DISTINCT verticals,
 * so every count is 1, the discriminant is always 0 and the tie-break decides
 * the whole order. That is exactly why the RESTING slice is no longer the head
 * of this list — see `restingChips`.
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

/** How many records this chip would leave on the grid, from a clean slate. */
export function chipMatchCount(records: SiteRecord[], chip: SiteChip): number {
  return applyFilters(records, toggleChip(chip, {})).length;
}

/** What the chip filters, and how hard — the resting row mixes kinds, so it says which. */
export function chipTitle(records: SiteRecord[], chip: SiteChip): string {
  const kind = chip.kind === "vertical" ? "Vertical" : chip.kind === "axis" ? "Design register" : "Build wave";
  const n = chipMatchCount(records, chip);
  return `${kind} · ${n} ${n === 1 ? "site" : "sites"}`;
}

/**
 * WHICH five chips rest in the row (s79 verify round, S2 2/3 + S3 3/3 — one
 * change because they are one row).
 *
 * The sheet draws five chips then "More →", and that geometry is kept byte-true.
 * Two things were wrong about the five it drew here:
 *
 * 1. **An ACTIVE chip could sit past the bound.** Expand the row, pick a wave,
 *    collapse it: the grid stayed filtered with no chip on screen naming what
 *    filtered it. (The header pill did say "5 of 20 built", so the slice was
 *    never silent — but a count is not the filter's identity, and the only
 *    "Clear filters" control lives in the zero-result state, which a working
 *    filter never reaches.) Actives lead the slice now, so the pick is always
 *    on screen and one click clears it. At most three can be active — one per
 *    kind — so the sheet's five slots always have room for the rest.
 * 2. **The other slots went to bookmarks, not cuts.** The head of the row is
 *    verticals, and on today's catalog every vertical matches exactly ONE site,
 *    so the resting row was five one-result niches while the registers and
 *    waves — the facets that actually group the portfolio — were all behind
 *    "More →". A chip that cuts 20 to 1 is a lookup; a chip that cuts 20 to 9
 *    is a filter. So the remaining slots go to the chips that cut hardest,
 *    skipping any that match one record (a bookmark) or all of them (no cut).
 *
 * Nothing is dropped: every chip stays in the expanded row in its own reading
 * order. This only decides who gets the five seats.
 */
export function restingChips(
  chips: SiteChip[],
  records: SiteRecord[],
  filters: SiteFilters,
): SiteChip[] {
  const active = chips.filter((c) => chipActive(c, filters));
  const rest = chips.filter((c) => !chipActive(c, filters));
  const counted = rest.map((chip) => ({ chip, n: chipMatchCount(records, chip) }));
  const cuts = counted
    .filter(({ n }) => n > 1 && n < records.length)
    .sort((a, b) => b.n - a.n)
    .map(({ chip }) => chip);
  // Fill from the row's own order when there aren't five real cuts to give —
  // the row stays five chips deep rather than shrinking below the sheet.
  const filler = rest.filter((c) => !cuts.includes(c));
  return [...active, ...cuts, ...filler].slice(0, PRIMARY_CHIPS);
}

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
