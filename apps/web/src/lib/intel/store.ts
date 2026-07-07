import { fixtureTrendCards } from "./fixtures";
import type { CreateContext, CreateFamily, IntelCapture, TrendCard } from "./types";

/**
 * The Intel FAKE-DRIVER capture store (B6.2, the B5.4 staged-flow
 * precedent): operator actions on demo trend cards are recorded in-memory
 * as the exact payload shape pass 3 lands durably (ADR 0005 decision 3:
 * promote/dismiss on intel cards feed edit_diffs → eval rows — the write
 * door is approvals.record, which is draft-scoped today; a later contract
 * window opens the intel-action path). Deterministic clock — the fake seam
 * never reads Date.now() (staged-flow store convention).
 *
 * Wave-3 context spine (workspace-ux-v2.md §3): promote/target-this hand
 * Create a CAPTURE ID, not a query-string prompt — Create resolves the
 * structured context back out of the capture, so context flows forward and
 * is never re-asked. Promote and dismiss write SYMMETRIC payloads through
 * this one door (the same base fields, promote adding the operator's
 * title/angle pick) — the eval-row write lands both when the window opens.
 *
 * Real-vs-fake boundary, on purpose: monitored AREAS and search TARGETS are
 * REAL repo rows behind /api/intel routes; only the ranked trend cards and
 * their dismiss/promote captures are fixture-backed until B6.5 arms the
 * live pollers.
 */

const FIXTURE_INTEL_BASE_MS = Date.UTC(2026, 6, 5, 12, 0, 0);

interface IntelStoreState {
  dismissed: Set<string>;
  captures: IntelCapture[];
  tick: number;
}

let state: IntelStoreState = { dismissed: new Set(), captures: [], tick: 0 };

function nextAt(): string {
  state.tick += 1;
  return new Date(FIXTURE_INTEL_BASE_MS + state.tick * 1000).toISOString();
}

export class IntelStoreError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: 400 | 404 = 404,
  ) {
    super(message);
    this.name = "IntelStoreError";
  }
}

/** The demo cards minus session-dismissed ones — a dismissal is visible immediately, like the real thing will be. */
export function listTrendCards(): TrendCard[] {
  return fixtureTrendCards.filter((card) => !state.dismissed.has(card.id));
}

/** B6.5: live cards filter through the SAME session-dismissal set as fixtures (durable eval-row write = the next contract window). */
export function isTrendCardDismissed(cardId: string): boolean {
  return state.dismissed.has(cardId);
}

function requireCard(cardOrId: TrendCard | string): TrendCard {
  if (typeof cardOrId !== "string") return cardOrId;
  const card = fixtureTrendCards.find((c) => c.id === cardOrId);
  if (!card) throw new IntelStoreError(`trend card "${cardOrId}" is not in the demo dataset`, 404);
  return card;
}

/** The symmetric base payload both dismiss and promote record (one capture door). */
function cardPayload(card: TrendCard): Record<string, unknown> {
  return {
    source: card.source,
    externalId: card.externalId,
    areaName: card.areaName,
    score: card.score,
    text: card.text,
    url: card.url ?? null,
  };
}

/** Dismissal is SIGNAL, not deletion: the capture row is the point (→ eval row in pass 3). B6.5: routes resolve LIVE cards themselves and pass the card object; the string form stays the fixture path. */
export function dismissTrendCard(cardOrId: TrendCard | string): IntelCapture {
  const card = requireCard(cardOrId);
  state.dismissed.add(card.id);
  const capture: IntelCapture = {
    id: `intel-capture-${state.tick + 1}`,
    kind: "trend_dismiss",
    ref: card.id,
    at: nextAt(),
    payload: cardPayload(card),
  };
  state.captures.push(capture);
  return capture;
}

export interface PromotePick {
  /** Which exit door the operator clicked: → Video · → Post · → Page. */
  family: CreateFamily;
  /** Dossier picks — default to the first entry (the smart default at the seam). */
  titleIndex?: number;
  angleIndex?: number;
}

function pick(list: string[], index: number | undefined, what: string): string | undefined {
  if (list.length === 0) return undefined;
  const i = index ?? 0;
  if (!Number.isInteger(i) || i < 0 || i >= list.length) {
    throw new IntelStoreError(`${what} index ${String(index)} is out of range`, 400);
  }
  return list[i];
}

/** A per-family exit — the promote capture carries the full context the Create surface resolves. A live card without a dossier (generation not yet armed) promotes with the raw item context only — never invented titles. */
export function promoteTrendCard(cardOrId: TrendCard | string, opts: PromotePick): { capture: IntelCapture } {
  const card = requireCard(cardOrId);
  const capture: IntelCapture = {
    id: `intel-capture-${state.tick + 1}`,
    kind: "trend_promote",
    ref: card.id,
    at: nextAt(),
    payload: {
      ...cardPayload(card),
      family: opts.family,
      title: pick(card.dossier?.titles ?? [], opts.titleIndex, "title"),
      angle: pick(card.dossier?.angles ?? [], opts.angleIndex, "angle"),
      hook: card.dossier?.hook,
    },
  };
  state.captures.push(capture);
  return { capture };
}

/** "Target this" on a horizon card — the keyword context handoff, captured through the same door. */
export function targetSearchQuery(query: string, family: CreateFamily = "page"): { capture: IntelCapture } {
  const capture: IntelCapture = {
    id: `intel-capture-${state.tick + 1}`,
    kind: "search_target_this",
    ref: query,
    at: nextAt(),
    payload: { query, family },
  };
  state.captures.push(capture);
  return { capture };
}

/**
 * Resolve a capture id back into the structured Create context (wave-3 §3.3).
 * Dismiss captures are feedback, not context — resolving one is a 404.
 */
export function resolveCreateContext(captureId: string): CreateContext {
  const capture = state.captures.find((c) => c.id === captureId);
  if (!capture || capture.kind === "trend_dismiss") {
    throw new IntelStoreError(`capture "${captureId}" carries no Create context`, 404);
  }
  const p = capture.payload;
  const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : undefined);
  if (capture.kind === "search_target_this") {
    return {
      captureId: capture.id,
      kind: capture.kind,
      family: (p.family as CreateFamily) ?? "page",
      keyword: str(p.query),
    };
  }
  return {
    captureId: capture.id,
    kind: capture.kind,
    family: (p.family as CreateFamily) ?? "post",
    title: str(p.title),
    angle: str(p.angle),
    hook: str(p.hook),
    sourceUrl: str(p.url),
    areaName: str(p.areaName),
    score: typeof p.score === "number" ? p.score : undefined,
    text: str(p.text),
  };
}

export function listIntelCaptures(): IntelCapture[] {
  return [...state.captures];
}

/** Test hook, mirroring resetStagedFlowStore. */
export function resetIntelStore(): void {
  state = { dismissed: new Set(), captures: [], tick: 0 };
}
