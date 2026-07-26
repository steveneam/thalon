import { plannedSlotSchema } from "@thalon/contracts";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * The calendar's SLOT WRITE door (s78) — the route whose absence was why
 * Reschedule and Remove rendered disabled ("the planned-slot store has a read
 * route only").
 *
 * Nothing new was needed to open it: the `planned_slots` table shipped in the
 * Phase-I window (drizzle/0015_phase1_window.sql, s61), `plannedSlotSchema`
 * is already the contract's validated plan/re-plan boundary, and
 * `repos.plannedSlots` already owns the whole write story — a (tenant, draft)
 * unique index making `plan` an upsert, `draft.slot_planned` /
 * `draft.slot_replanned` / `draft.slot_unplanned` appended in the SAME
 * transaction, a foreign draft failing as `NotFoundError` (the tenancy wall),
 * and `unplan` idempotent-LOUD so a missing slot is a 404 rather than a
 * plausible success. So this file is what the repo doc always said the
 * calendar would have: thin, additive, no table, no contract, no migration.
 *
 * A slot is a PLAN, not a publish: writing one arms nothing and posts
 * nothing. The publish door stays behind its own explicit per-platform GO.
 */

interface WireSlot {
  draftId: string;
  scheduledFor: string;
  note: string | null;
}

function toWire(row: { draftId: string; scheduledFor: Date; note: string | null }): WireSlot {
  return {
    draftId: row.draftId,
    scheduledFor: row.scheduledFor.toISOString(),
    note: row.note,
  };
}

/** Plan or re-plan a draft's slot. Upsert by (tenant, draft) — the repo decides planned vs replanned. */
export async function POST(request: Request) {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = plannedSlotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "A slot needs a draft id and an instant with an offset.",
        fields: parsed.error.issues.map((issue) => issue.path.join(".")),
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ slot: toWire(await repos.plannedSlots.plan(ctx, parsed.data)) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** Remove a draft's plan. No slot is a 404, never a silent no-op — the repo's own posture. */
export async function DELETE(request: Request) {
  const draftId = new URL(request.url).searchParams.get("draftId") ?? "";
  if (!draftId) {
    return NextResponse.json({ error: "Name the draft whose plan to remove." }, { status: 400 });
  }

  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }

  try {
    await repos.plannedSlots.unplan(ctx, draftId);
    return NextResponse.json({ removed: draftId });
  } catch (err) {
    return toErrorResponse(err);
  }
}
