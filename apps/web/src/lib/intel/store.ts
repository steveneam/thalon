import { fixtureTrendCards } from "./fixtures";
import type { IntelCapture, TrendCard } from "./types";

/**
 * The Intel FAKE-DRIVER capture store (B6.2, the B5.4 staged-flow
 * precedent): operator actions on demo trend cards are recorded in-memory
 * as the exact payload shape pass 3 lands durably (ADR 0005 decision 3:
 * promote/dismiss on intel cards feed edit_diffs → eval rows — the write
 * door is approvals.record, which is draft-scoped today; a later contract
 * window opens the intel-action path). Deterministic clock — the fake seam
 * never reads Date.now() (staged-flow store convention).
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

function requireCard(cardId: string): TrendCard {
  const card = fixtureTrendCards.find((c) => c.id === cardId);
  if (!card) throw new IntelStoreError(`trend card "${cardId}" is not in the demo dataset`, 404);
  return card;
}

/** Dismissal is SIGNAL, not deletion: the capture row is the point (→ eval row in pass 3). */
export function dismissTrendCard(cardId: string): IntelCapture {
  const card = requireCard(cardId);
  state.dismissed.add(card.id);
  const capture: IntelCapture = {
    id: `intel-capture-${state.tick + 1}`,
    kind: "trend_dismiss",
    ref: card.id,
    at: nextAt(),
    payload: { source: card.source, externalId: card.externalId, areaName: card.areaName, score: card.score },
  };
  state.captures.push(capture);
  return capture;
}

/** "Generate from this" — the promote capture plus the prompt seed the Create surface receives. */
export function promoteTrendCard(cardId: string): { capture: IntelCapture; promptSeed: string } {
  const card = requireCard(cardId);
  const capture: IntelCapture = {
    id: `intel-capture-${state.tick + 1}`,
    kind: "trend_promote",
    ref: card.id,
    at: nextAt(),
    payload: { source: card.source, externalId: card.externalId, areaName: card.areaName, score: card.score },
  };
  state.captures.push(capture);
  return { capture, promptSeed: card.text };
}

/** "Target this" on a horizon card — generation context handoff, captured. */
export function targetSearchQuery(query: string): { capture: IntelCapture; promptSeed: string } {
  const capture: IntelCapture = {
    id: `intel-capture-${state.tick + 1}`,
    kind: "search_target_this",
    ref: query,
    at: nextAt(),
    payload: { query },
  };
  state.captures.push(capture);
  return { capture, promptSeed: query };
}

export function listIntelCaptures(): IntelCapture[] {
  return [...state.captures];
}

/** Test hook, mirroring resetStagedFlowStore. */
export function resetIntelStore(): void {
  state = { dismissed: new Set(), captures: [], tick: 0 };
}
