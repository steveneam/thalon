import { randomUUID } from "node:crypto";
import { fixtureTrendCards } from "./fixtures";
import type { CreateContext, CreateFamily, IntelCapture, TrendCard } from "./types";

/**
 * The Intel capture spine's FALLBACK seat, and the demo trend dataset.
 *
 * Two things live here, and s102 split them apart:
 *
 * 1. **The ACTIONS** — dismiss / promote / target-this / lead-promote each
 *    build one `CaptureDraft` (kind + ref + the structured payload) and
 *    validate the operator's dossier picks. Building is all this module
 *    does; it does not decide where the capture is SEATED.
 * 2. **The in-memory seat** — `recordFallbackCapture` / `resolveCreateContext`
 *    / `listIntelCaptures`. This is the fake driver (B6.2, the B5.4
 *    staged-flow precedent): deterministic clock, never reads Date.now().
 *
 * The DURABLE seat is `./captures.ts` over the `intel_captures` table
 * (Phase-I window, s61). It is the one production takes; this seat answers
 * only when no tenant resolves (an unseeded dev db, and the msw/unit tests).
 * Before s102 there WAS no durable seat: capture ids were `intel-capture-N`
 * off a per-process counter, so after a restart an Intel exit's `?ctx=` id
 * either vanished or — the reason this was the session's first fix —
 * resolved to a DIFFERENT capture that had since taken the same number. A
 * wrong-target promote beats a dead door for severity. The fallback id is a
 * uuid now (prefixed, so it can never be mistaken for a durable row id), so
 * even here a stale id 404s honestly instead of hitting someone else's pick.
 *
 * Wave-3 context spine (workspace-ux-v2.md §3): promote/target-this hand
 * Create a CAPTURE ID, not a query-string prompt — Create resolves the
 * structured context back out of the capture, so context flows forward and
 * is never re-asked. Promote and dismiss write SYMMETRIC payloads through
 * this one door (the same base fields, promote adding the operator's
 * title/angle pick).
 *
 * Real-vs-fake boundary, on purpose: monitored AREAS and search TARGETS are
 * REAL repo rows behind /api/intel routes; the ranked trend cards stay
 * fixture-backed until B6.5 arms the live pollers, and the session-dismissal
 * SET stays in memory (it is a view of this session; the capture row is the
 * record).
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

/**
 * One operator action, BUILT but not yet seated. `ref` is what was acted on
 * (a trend card id, a search query, a lead id); the durable table has no
 * column for it, so the durable seat folds it into the payload under `ref`
 * and lifts it back out on read.
 */
export interface CaptureDraft {
  kind: IntelCapture["kind"];
  ref: string;
  payload: Record<string, unknown>;
}

/**
 * Seat a draft in memory. The id is a uuid rather than the old
 * `intel-capture-${tick}` counter: a counter restarts with the process, so a
 * `?ctx=` link from before a restart used to resolve to whatever capture had
 * since taken that number. The `intel-capture-` prefix is kept so a fallback
 * id can never be mistaken for a durable row id (the durable seat routes on
 * exactly that shape).
 */
export function recordFallbackCapture(draft: CaptureDraft): IntelCapture {
  const capture: IntelCapture = {
    id: `intel-capture-${randomUUID()}`,
    kind: draft.kind,
    ref: draft.ref,
    at: nextAt(),
    payload: draft.payload,
  };
  state.captures.push(capture);
  return capture;
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
    thumbnailUrl: card.thumbnailUrl ?? null,
  };
}

/**
 * Dismissal is SIGNAL, not deletion: the capture is the point (→ eval row in
 * pass 3). B6.5: routes resolve LIVE cards themselves and pass the card
 * object; the string form stays the fixture path. The session-dismissal set
 * is updated here — that set is this session's VIEW; the capture is the
 * record, and only the capture is seated durably.
 */
export function dismissTrendCard(cardOrId: TrendCard | string): CaptureDraft {
  const card = requireCard(cardOrId);
  state.dismissed.add(card.id);
  return { kind: "trend_dismiss", ref: card.id, payload: cardPayload(card) };
}

export interface PromotePick {
  /** Which exit door the operator clicked: → Video · → Post · → Page. */
  family: CreateFamily;
  /** The REQUIRED dossier pick — absent means "the first one", which is what the card's label promises. */
  titleIndex?: number;
  /** The OPTIONAL dossier pick — absent means NO angle rides. Never defaulted. */
  angleIndex?: number;
}

function inRange(list: string[], i: number, index: number | undefined, what: string): string {
  if (!Number.isInteger(i) || i < 0 || i >= list.length) {
    throw new IntelStoreError(`${what} index ${String(index)} is out of range`, 400);
  }
  return list[i];
}

/** A title always rides — the card says so ("Title · one always rides"), so absent means the first. */
function pickRequired(list: string[], index: number | undefined, what: string): string | undefined {
  if (list.length === 0) return undefined;
  return inRange(list, index ?? 0, index, what);
}

/**
 * An angle is the operator's OPTIONAL extra, and absent must mean absent.
 * This used to share the required default (`index ?? 0`), so a card promoted
 * with no angle picked still carried angles[0] into Create — which made the
 * dossier's own "Click again to ride without an angle" a false promise, and
 * seeded the brief with an angle nobody chose (s77 finding, live-confirmed
 * s79: promoting with zero angle clicks wrote "Angle: <angles[0]>" into the
 * Create prompt). The two defaults are now split at the seam.
 */
function pickOptional(list: string[], index: number | undefined, what: string): string | undefined {
  if (list.length === 0 || index === undefined) return undefined;
  return inRange(list, index, index, what);
}

/** A per-family exit — the promote capture carries the full context the Create surface resolves. A live card without a dossier (generation not yet armed) promotes with the raw item context only — never invented titles. */
export function promoteTrendCard(cardOrId: TrendCard | string, opts: PromotePick): CaptureDraft {
  const card = requireCard(cardOrId);
  return {
    kind: "trend_promote",
    ref: card.id,
    payload: {
      ...cardPayload(card),
      family: opts.family,
      title: pickRequired(card.dossier?.titles ?? [], opts.titleIndex, "title"),
      angle: pickOptional(card.dossier?.angles ?? [], opts.angleIndex, "angle"),
      hook: card.dossier?.hook,
    },
  };
}

export interface LeadPromoteInput {
  leadId: string;
  family: CreateFamily;
  name: string | null;
  company: string | null;
  role: string | null;
  website: string | null;
  notes: string | null;
  painPoint: string | null;
  score: number | null;
}

/**
 * A per-family exit on a LEAD card (B-crm.2): everything the CRM gathered
 * about the lead rides the SAME capture door and the same Create-context
 * resolver as intel promotes — one handoff spine app-wide, context never
 * retyped (the Kompozy-style feature composition the founder asked for:
 * lead → post/video/page briefed by the lead's own context).
 */
export function promoteLead(input: LeadPromoteInput): CaptureDraft {
  return { kind: "lead_promote", ref: input.leadId, payload: { ...input } };
}

/** "Target this" on a horizon card — the keyword context handoff, captured through the same door. */
export function targetSearchQuery(query: string, family: CreateFamily = "page"): CaptureDraft {
  return { kind: "search_target_this", ref: query, payload: { query, family } };
}

/**
 * Project one capture into the structured Create context (wave-3 §3.3).
 * Seat-agnostic on purpose: the durable row and the in-memory capture reach
 * this same function, so a promote resolves identically either side of a
 * restart. Dismiss captures are feedback, not context — projecting one is a
 * 404.
 */
export function captureToContext(capture: IntelCapture): CreateContext {
  if (capture.kind === "trend_dismiss") {
    throw new IntelStoreError(`capture "${capture.id}" carries no Create context`, 404);
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
  if (capture.kind === "lead_promote") {
    return {
      captureId: capture.id,
      kind: capture.kind,
      family: (p.family as CreateFamily) ?? "post",
      leadId: capture.ref,
      company: str(p.company),
      contact: str(p.name),
      role: str(p.role),
      painPoint: str(p.painPoint),
      // The lead's website is the natural grounding link; notes are its source text.
      sourceUrl: str(p.website),
      text: str(p.notes),
      score: typeof p.score === "number" ? p.score : undefined,
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

/**
 * The fallback seat's resolve read. A missing id is a 404 here exactly as it
 * is durably — never a silent empty context.
 */
export function resolveCreateContext(captureId: string): CreateContext {
  const capture = state.captures.find((c) => c.id === captureId);
  if (!capture) {
    throw new IntelStoreError(`capture "${captureId}" carries no Create context`, 404);
  }
  return captureToContext(capture);
}

export function listIntelCaptures(): IntelCapture[] {
  return [...state.captures];
}

/** Test hook, mirroring resetStagedFlowStore. */
export function resetIntelStore(): void {
  state = { dismissed: new Set(), captures: [], tick: 0 };
}
