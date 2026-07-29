import type {
  CreateFamily as ContractCreateFamily,
  MonitoredAreaConfig,
  MonitoredAreaStatus,
  SearchTargetOrigin,
  SearchTargetStatus,
} from "@thalon/contracts";

/**
 * Wire types for the Intel surface (B6.2 over the frozen B6.4/B6.8
 * contract). Dates cross the wire as ISO strings. TrendCard mirrors the
 * engine ranker's RankedCandidate rows and HorizonCard the horizon math's
 * HorizonScore — defined here as wire shapes because apps/web is
 * engine-free (contracts + API routes only, the B5.4 doctrine).
 */

export interface AreaRow {
  id: string;
  name: string;
  description: string;
  status: MonitoredAreaStatus;
  config: MonitoredAreaConfig;
  createdAt: string;
  updatedAt: string;
}

/**
 * The dossier block on a trend card (wave-3, workspace-ux-v2.md §3): ready
 * creative context so the card is a doorway, not a readout. Fixture-shaped
 * today; live title/angle generation lands with B6.5 behind the gateway
 * top-up, riding the existing metered choke points.
 */
export interface TrendDossier {
  /** 3–5 ready titles the operator can fire or copy. */
  titles: string[];
  /** 2–3 suggested angles — grounded in why the item is rising, never near-clones. */
  angles: string[];
  /** One hook line for the opening beat. */
  hook: string;
}

/** One ranked (item × area) row — the Trends tab card. */
export interface TrendCard {
  /** Stable card id (fixture id today; the ranked row's source identity once B6.5 arms). */
  id: string;
  source: string;
  externalId: string;
  url?: string;
  /** Platform thumbnail for visual origins (Source-Link Rule) — absent until a live driver provides one; never synthesized for demo cards. */
  thumbnailUrl?: string;
  /** Intrinsic size of that thumbnail when the platform reported it — what decides crop vs contain (B-media.0). */
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  /** When the sweep that carried this thumbnail ran — the ref's provenance stamp, not the item's publish time. */
  capturedAt?: string;
  text: string;
  account: string;
  publishedAt: string;
  areaName: string;
  /** Weight-normalized [0,1] rank score. */
  score: number;
  /** One line per armed signal — the operator sees WHY (ranker.ts format). */
  reasons: string[];
  isOutlier: boolean;
  /** Engagement ratios for the card's stat strip. */
  shareToView: number | null;
  bookmarkToView: number | null;
  metrics: Record<string, number>;
  /** Absent on live cards until title/angle generation arms (gateway top-up) — never fabricated. */
  dossier?: TrendDossier;
}

/** Sweep cadence for the Intel header stamp — honest about fake-driver mode. */
export interface SweepStamp {
  /** When the dataset was last swept (fixture stamp while demo). */
  lastSweptAt: string;
  /** The cadence live polling will run at (config once B6.5 arms). */
  intervalHours: number;
  /** The REAL next scheduled sweep (B-arm.1: lastSweepAt + cadence when a schedule is enabled) — null when no schedule is enabled, there IS no next sweep. */
  nextSweepAt: string | null;
  /** true when an enabled schedule is already past due (or has never swept) — the scheduler runs it on its next tick. */
  dueNow?: boolean;
}

/**
 * One swept platform's own stamp (B-learn L2 slice 1): the trends read is
 * the merged union across sources, so each source states when IT was last
 * swept and how many cards it contributed — the surface can name the
 * platforms honestly instead of implying one sweep covered them all.
 */
export interface SourceSweepStamp {
  source: string;
  lastSweptAt: string;
  cards: number;
}

export interface TrendsPayload {
  areas: AreaRow[];
  cards: TrendCard[];
  /** true while cards come from the built-in demo dataset (live pollers arm at B6.5). */
  demo: boolean;
  sweep: SweepStamp;
  /** Per-source stamps behind the merged `cards` — empty in the demo era. */
  sources: SourceSweepStamp[];
}

export interface TargetRow {
  id: string;
  keyword: string;
  origin: SearchTargetOrigin;
  status: SearchTargetStatus;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** One (query × page) horizon series — the Search tab card (horizon.ts HorizonScore shape). */
export interface HorizonCard {
  query: string;
  /** "" = the site-level aggregate (the storage convention). */
  page: string;
  snapshots: number;
  position: number | null;
  impressionsGrowth: number | null;
  latestImpressions: number | null;
  ctr: number | null;
  expectedCtr: number | null;
  /** One line per rule that fired, verbatim from the math — never model vibes. */
  reasons: string[];
  isOpportunity: boolean;
}

export interface HorizonPayload {
  cards: HorizonCard[];
  /** true while cards come from the built-in demo dataset (GSC arms after the B6.7 deploy). */
  demo: boolean;
}

/** Operator intel actions captured for the feedback loop (dismiss/promote → eval rows in pass 3). */
export interface IntelCapture {
  id: string;
  kind: "trend_dismiss" | "trend_promote" | "search_target_this" | "lead_promote";
  /** What was acted on: a TrendCard id, a search query, or a lead id. */
  ref: string;
  at: string;
  payload: Record<string, unknown>;
}

/**
 * The Create output families — shared by the per-family card exits and the
 * Create picker. `email` (B-crm.4 front half, session 29) is the lead-only
 * outreach family: it composes FROM a lead's context, so only lead cards
 * carry its exit and only a lead_promote context can arm its compose.
 *
 * s87 window: re-pointed at the contracts vocabulary (`CREATE_FAMILIES`)
 * instead of the hand-copied union it used to be. The engine dispatches on
 * this list; a second copy of it here could drift from the one that picks
 * the engine, which is the mirror the format-registry docblock warns about.
 */
export type CreateFamily = ContractCreateFamily;

/**
 * The structured context object behind a capture id (wave-3 §3): what the
 * intel→create handoff carries so the operator never retypes what intel
 * already knew. Rendered on Create as removable context chips.
 */
export interface CreateContext {
  captureId: string;
  kind: "trend_promote" | "search_target_this" | "lead_promote";
  /** Which exit door was clicked — Create's family pre-pick (still changeable). */
  family: CreateFamily;
  /** The operator-selected ready title (the brief's working title). */
  title?: string;
  angle?: string;
  hook?: string;
  sourceUrl?: string;
  areaName?: string;
  keyword?: string;
  score?: number;
  /** The original item text — provenance the operator can keep or prune. */
  text?: string;
  /** Lead handoff (B-crm.2): everything the CRM gathered rides forward — never retyped. */
  company?: string;
  contact?: string;
  role?: string;
  painPoint?: string;
  /** The lead row behind a lead_promote capture — what the →Email compose addresses (B-crm.4 front half). */
  leadId?: string;
}
