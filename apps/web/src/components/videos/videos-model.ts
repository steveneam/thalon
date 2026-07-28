import type { VideoCutStatus } from "@thalon/contracts";
import type { CutView, ProjectDetail, TakeView } from "@/lib/videos/types";

/**
 * Videos overview read model — the pure half of the exact-mock rebuild. The
 * sheet (docs/research/mock-sheets/Videos Overview.dc.html) draws a card of
 * four facts: a state pill, a runtime badge, a family line and a provenance
 * stamp. This module decides what each one may honestly SAY about a real
 * project, and nothing here touches the DOM.
 *
 * The engine's own vocabulary replaces the sheet's fixture words wherever
 * they disagree: a cut is draft → rendered → approved (the contract's
 * transition order), and nothing publishes a video to a platform yet, so no
 * card ever claims one.
 */

export interface FamilyPart {
  text: string;
  /** A door (the sheet's dotted family link); false = a plain subtle fact. */
  door: boolean;
}

export interface StatePill {
  text: string;
  className: string;
}

/** The contract's own progression (VIDEO_CUT_TRANSITIONS). */
const STATE_RANK: Readonly<Record<VideoCutStatus, number>> = {
  draft: 0,
  rendered: 1,
  approved: 2,
};

/**
 * The cut a card speaks for: the furthest-along one, newest on a tie. ONE
 * rule for the whole card, so the pill, the runtime badge and the
 * provenance stamp can never end up describing different cuts.
 */
export function headlineCut(cuts: CutView[]): CutView | null {
  return (
    [...cuts].sort(
      (a, b) =>
        STATE_RANK[b.status] - STATE_RANK[a.status] || b.createdAt.localeCompare(a.createdAt),
    )[0] ?? null
  );
}

/**
 * The sheet's state pill, in the engine's words. `approved` is the furthest
 * a video gets today — the sheet's fixture says "published"/"live on 3",
 * but no publish path carries video to a platform, so no card says it.
 */
export function statePill(cut: CutView | null): StatePill {
  if (!cut) return { text: "no cuts yet", className: "pill pill-idle" };
  return cut.status === "approved"
    ? { text: "approved", className: "pill pill-ok" }
    : { text: cut.status, className: "pill pill-idle" };
}

/** The poster's runtime badge — m:ss of the headline cut's output. */
export function runtime(cut: CutView | null): string | null {
  if (!cut) return null;
  const total = Math.max(0, Math.round(cut.edl.duration));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * The family line — the sheet's three derivative dimensions, mapped onto
 * the three this engine actually records: versions of the headline cut,
 * derived aspect cuts (each one a recut with its lineage pinned), and the
 * takes the project holds. A dimension with nothing in it is left out
 * rather than restated (the state pill already says "no cuts yet"), exactly
 * as the sheet's own second card carries two parts instead of three.
 *
 * Platform renders are the fourth dimension the sheet draws and this engine
 * has no join for; the surface says that once, in the closing record line,
 * instead of implying zero on every card.
 */
export function family(detail: ProjectDetail, cut: CutView | null): FamilyPart[] {
  const versions = cut === null ? 0 : detail.cuts.filter((c) => c.name === cut.name).length;
  // Scoped to the cut this card SPEAKS FOR — the same one the pill, the
  // runtime badge and the provenance stamp describe, and the same one the
  // dossier opens its aspect band on. It used to count every derived cut in
  // the project, which broke the card's own one-rule doctrine twice: the
  // card read "4 aspect cuts" while the dossier it opened said "none yet"
  // (live s79, thalon-concept-film — the four hang off concept-film-16x9
  // v6, not off the headline), and a headline cut that is ITSELF a recut
  // counted itself among its own derivatives.
  const recuts = derivedFrom(detail.cuts, cut).length;
  const parts: FamilyPart[] = [];
  if (versions > 0) parts.push({ text: plural(versions, "version"), door: true });
  if (recuts > 0) parts.push({ text: plural(recuts, "aspect cut"), door: true });
  parts.push(
    detail.takes.length === 0
      ? { text: "no takes yet", door: false }
      : { text: plural(detail.takes.length, "take"), door: true },
  );
  return parts;
}

/**
 * The one model every take's pinned manifest names, or null when they
 * disagree or none records one. VISIBLE PROVENANCE (plan §5) wants the mint
 * named where it is known — never guessed from a majority.
 */
export function mintModel(takes: TakeView[]): string | null {
  const models = new Set(
    takes.map((t) => t.provenance.model).filter((m): m is string => typeof m === "string"),
  );
  return models.size === 1 ? [...models][0] : null;
}

/** The sheet's mono provenance stamp: what the card's picture came from. */
export function provenance(detail: ProjectDetail, cut: CutView | null): string {
  const model = mintModel(detail.takes);
  const head = cut === null ? "takes only · no cut yet" : `${cut.name} v${cut.version}`;
  return model === null ? head : `${head} · ${model}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function startOfUtcDay(ms: number): number {
  return Math.floor(ms / 86_400_000);
}

/** The sheet's own date grammar: "today" · a weekday inside the week · "18 Jul". */
export function cardDate(iso: string, now: number): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const days = startOfUtcDay(now) - startOfUtcDay(at.getTime());
  if (days <= 0) return "today";
  if (days < 7) return WEEKDAYS[at.getUTCDay()];
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
}

/* ── The dossier's own reads (Video Dossier.dc.html) ───────────────────── */

/** Every version of one cut name, oldest first — the version strip's spine. */
export function versionsOf(cuts: CutView[], name: string): CutView[] {
  return cuts.filter((c) => c.name === name).sort((a, b) => a.version - b.version);
}

/** The cuts derived FROM a given version (B-ve.5 lineage pins the exact parent row). */
export function derivedFrom(cuts: CutView[], parent: CutView | null): CutView[] {
  if (parent === null) return [];
  return cuts
    .filter((c) => c.lineage?.parentCutId === parent.id)
    .sort((a, b) => a.name.localeCompare(b.name) || a.version - b.version);
}

/**
 * The recuts this project holds that hang off some OTHER version — what the
 * card's family line deliberately no longer counts. The aspect band is
 * per-version by design ("one dimension per band"), so an empty band on one
 * version must still say the project has recuts elsewhere, or narrowing the
 * card's count would simply hide them (s79: four recuts, all off
 * concept-film-16x9 v6, invisible from the headline's own band).
 */
export function derivedElsewhere(cuts: CutView[], parent: CutView | null): CutView[] {
  const parentId = parent?.id ?? null;
  return cuts.filter(
    // The picked cut may itself be a recut (the live case), and the thing on
    // screen is never "elsewhere".
    (c) => c.lineage !== null && c.lineage.parentCutId !== parentId && c.id !== parentId,
  );
}

/** The cut a set of recuts hangs off, when they all share one parent — named, never guessed from a majority. */
export function soleParentOf(cuts: CutView[], derived: CutView[]): CutView | null {
  const parents = new Set(derived.map((c) => c.lineage?.parentCutId).filter(Boolean));
  if (parents.size !== 1) return null;
  return cuts.find((c) => c.id === [...parents][0]) ?? null;
}

/**
 * A derived cut is STALE when its parent has moved on since the pin. There
 * is no auto-sync by design (auto-apply does not exist), so the surface says
 * it rather than quietly resyncing.
 */
export function staleAgainstParent(cut: Pick<CutView, "lineage">): boolean {
  const { lineage } = cut;
  return (
    lineage !== null &&
    lineage.parentVersion !== null &&
    lineage.parentLatestVersion !== null &&
    lineage.parentLatestVersion > lineage.parentVersion
  );
}

/**
 * The version strip's attribution line — the sheet's "every version names
 * what changed it". A cut written before the attributed save door existed
 * (the import's own rows) says so; it never gets an author guessed for it.
 */
export function attributionLine(
  // Structural, not `CutView`: the EDITOR holds a `CutDetail` (the same cut,
  // carrying its full EDL instead of a summary) and needs the same sentence.
  // Provenance that only the browse surface can state is provenance the
  // operator does not have where they act.
  cut: Pick<CutView, "attribution" | "createdAt">,
  now: number,
): string {
  const when = cardDate(cut.createdAt, now);
  // Nullish, not `=== null`: a payload cached from a deploy before this
  // field existed arrives undefined, and an unknown author is still unknown.
  const attribution = cut.attribution ?? null;
  if (attribution === null) return `no attribution recorded · ${when}`;
  if (attribution.authoredBy === "operator") return `your edit · ${when}`;
  const proposal = attribution.proposal;
  const ask = proposal?.ask ? ` · “${proposal.ask}”` : "";
  return `agent · ${proposal?.model ?? "model unrecorded"}${ask} · ${when}`;
}

/**
 * The scrub's timecode, the sheet's own format — m:ss.t. Counted in whole
 * TENTHS so a float duration can't round 59.99 into "0:60.0".
 */
export function timecode(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 10));
  const tenths = total % 10;
  const whole = (total - tenths) / 10;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}.${tenths}`;
}

/** The sheet's segmented control, in the engine's state vocabulary. */
export const FILTERS = [
  { id: "all", label: "All" },
  { id: "approved", label: "Approved" },
  { id: "rendered", label: "Rendered" },
  { id: "draft", label: "Drafts" },
] as const;

export type FilterId = (typeof FILTERS)[number]["id"];

/**
 * A project passes a state filter on its HEADLINE cut — the same cut the
 * pill names, so the grid never hides a card whose pill says it matches.
 * A project with no cuts has no state and appears under All only.
 */
export function passesFilter(cut: CutView | null, filter: FilterId): boolean {
  return filter === "all" ? true : cut !== null && cut.status === filter;
}
