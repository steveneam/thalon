import type { CaptureKind, TenantCtx } from "@thalon/contracts";
import type { IntelCaptureRow, Repos } from "@thalon/db";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import {
  captureToContext,
  IntelStoreError,
  listIntelCaptures,
  recordFallbackCapture,
  resolveCreateContext,
  type CaptureDraft,
} from "./store";
import type { CreateContext, IntelCapture } from "./types";

/**
 * The intel CAPTURE DOOR — one seam, two seats.
 *
 * Every operator action that hands Create a context (promote · target-this ·
 * lead-promote) and every dismissal is seated here. When a tenant resolves,
 * that means a row in `intel_captures` — the durable spine built at s61 and
 * left unused until s102. When no tenant resolves (an unseeded dev db; the
 * msw/unit tests) it means the in-memory fallback in `./store.ts`.
 *
 * WHY THIS EXISTS (the s102 phase-1 fix): capture ids used to be
 * `intel-capture-${counter}` in one process's memory, while the `?ctx=` link
 * they mint is a URL the operator can sit on across a deploy. After a restart
 * that link either 404d or — worse, and the reason this led the session —
 * resolved to a DIFFERENT capture that had since taken the same number, so a
 * promote could brief Create from someone else's pick. A wrong target beats a
 * dead door for severity.
 *
 * Two things this seam is deliberately strict about:
 * - **A durable seat never silently degrades.** If a tenant resolves and the
 *   write throws, the error is the answer (a 500 naming the fact). Falling
 *   back to memory there would mint an id that dies at the next restart —
 *   the exact bug, re-introduced quietly.
 * - **A non-uuid id never reaches the database.** `intel_captures.id` is a
 *   uuid column, so handing Postgres a stale `intel-capture-…` string throws
 *   `invalid input syntax for type uuid` — a 500 where the honest answer is
 *   404. Those ids route to the fallback seat, which answers the 404 itself.
 */

/** `intel_captures` has no `ref` column; the payload carries it under this key and read lifts it back out. */
const REF_KEY = "ref";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DurableSeat {
  repos: Repos;
  ctx: TenantCtx;
}

/** The durable seat, or null when the configured tenant has not been seeded (fresh dev db, tests). */
async function durableSeat(): Promise<DurableSeat | null> {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  return ctx ? { repos, ctx } : null;
}

function rowToCapture(row: IntelCaptureRow): IntelCapture {
  const stored = { ...((row.payload ?? {}) as Record<string, unknown>) };
  const ref = typeof stored[REF_KEY] === "string" ? (stored[REF_KEY] as string) : "";
  delete stored[REF_KEY];
  return {
    id: row.id,
    kind: row.kind as IntelCapture["kind"],
    ref,
    at: row.createdAt.toISOString(),
    payload: stored,
  };
}

/** Seat one built action. Returns the capture wearing the id the `?ctx=` link will carry. */
export async function recordCapture(draft: CaptureDraft): Promise<IntelCapture> {
  const seat = await durableSeat();
  if (!seat) return recordFallbackCapture(draft);
  const row = await seat.repos.intelCaptures.record(seat.ctx, {
    kind: draft.kind,
    payload: { ...draft.payload, [REF_KEY]: draft.ref },
  });
  return rowToCapture(row);
}

/**
 * Resolve a capture id back into the structured Create context. A durable
 * seat answers durably; a fallback-minted id (or any non-uuid string an
 * operator typed) is answered by the fallback seat, which 404s honestly
 * rather than putting a bad literal in front of the uuid column.
 */
export async function resolveCaptureContext(captureId: string): Promise<CreateContext> {
  const seat = UUID_RE.test(captureId) ? await durableSeat() : null;
  if (!seat) return resolveCreateContext(captureId);
  const row = await seat.repos.intelCaptures.get(seat.ctx, captureId);
  if (!row) {
    throw new IntelStoreError(`capture "${captureId}" carries no Create context`, 404);
  }
  return captureToContext(rowToCapture(row));
}

/** The pipeline board's picks read: recent `trend_promote` captures, newest first, bounded. */
export async function listCapturesOfKind(kind: CaptureKind, limit = 200): Promise<IntelCapture[]> {
  const seat = await durableSeat();
  if (!seat) return listIntelCaptures().filter((capture) => capture.kind === kind);
  const rows = await seat.repos.intelCaptures.listRecent(seat.ctx, { kind, limit });
  return rows.map(rowToCapture);
}
