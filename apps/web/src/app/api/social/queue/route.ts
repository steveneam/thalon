import {
  InvalidPublishQueueTransitionError,
  publishQueueStatusSchema,
  socialPlatformSchema,
} from "@thalon/contracts";
import { InvalidStateError } from "@thalon/db";
import { scheduleApprovedDraft } from "@thalon/engine";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * C2 (s82): the publish queue's operator door — Approve's *Schedule* verb
 * and its way back out. Thin wiring over the engine producer
 * (`scheduleApprovedDraft`), which owns every refusal rung, and over the
 * frozen `publishQueue` repo, which owns idempotency and the events.
 *
 * A QUEUE ROW IS NOT A PUBLISH. Writing one arms nothing and posts nothing:
 * the row sits `pending` until a consumer that ships DISARMED walks it
 * through the publish door, whose whole refusal ladder still stands in
 * front of any platform call. Arming, the per-platform GO and the per-post
 * GO all remain the founder's.
 *
 * It is deliberately a SEPARATE fact from `planned_slots` (/api/calendar/
 * slots): a plan is "I was thinking Tuesday", a queue row is "this goes out
 * at 09:30, and here is the idempotency key behind it". Collapsing them
 * would make those two sentences the same claim.
 */

interface WireQueueRow {
  id: string;
  draftId: string;
  platform: string;
  scheduledAt: string | null;
  status: string;
  /** Why a failed row failed, verbatim — the row says it on its own face. */
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

function toWire(row: {
  id: string;
  draftId: string;
  platform: string;
  scheduledAt: Date | null;
  status: string;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WireQueueRow {
  return {
    id: row.id,
    draftId: row.draftId,
    platform: row.platform,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    status: row.status,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * The queue's two STATE-CONFLICT refusals, mapped honestly.
 *
 * The shared mapper (lib/http-errors.ts) already sends the drafts state
 * machine's `InvalidTransitionError` to 409; `publish_queue`'s exact sibling
 * shipped in the s82 window and has not been added there yet, and the repo's
 * `InvalidStateError` (a second live row for this draft+platform) is the same
 * shape of answer. Both would otherwise fall through as 400 "bad request" —
 * but the request was fine; the ROW's state refused, and the operator's next
 * move is to cancel a row, not to fix their input. Handled here rather than by
 * editing the shared mapper, which is outside this lane's file set; folding
 * these two into it is a one-line change for whoever owns that file next.
 */
function queueErrorResponse(err: unknown): NextResponse {
  if (err instanceof InvalidPublishQueueTransitionError || err instanceof InvalidStateError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  return toErrorResponse(err);
}

/** This tenant's queue rows, earliest slot first. `?draftId=` narrows to one draft's rows (the Approve card's read). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }

  const statusParam = params.get("status");
  const status = statusParam ? publishQueueStatusSchema.safeParse(statusParam) : null;
  if (status && !status.success) {
    return NextResponse.json(
      { error: `"status" must be one of: ${publishQueueStatusSchema.options.join(", ")}` },
      { status: 400 },
    );
  }
  const platformParam = params.get("platform");
  const platform = platformParam ? socialPlatformSchema.safeParse(platformParam) : null;
  if (platform && !platform.success) {
    return NextResponse.json(
      { error: `"platform" must be one of: ${socialPlatformSchema.options.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const rows = await repos.publishQueue.list(ctx, {
      ...(status?.success ? { status: status.data } : {}),
      ...(platform?.success ? { platform: platform.data } : {}),
    });
    const draftId = params.get("draftId");
    const scoped = draftId ? rows.filter((row) => row.draftId === draftId) : rows;
    return NextResponse.json({ rows: scoped.map(toWire) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * Schedule an approved draft onto a platform at an instant. Every refusal
 * is the engine's and lands as a typed 409 naming exactly what is wrong —
 * the draft is not approved, the slot has passed, the post does not fit the
 * platform's ceiling, or a live row for this draft+platform already stands
 * in the way.
 */
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
  const input = body as { draftId?: unknown; platform?: unknown; scheduledAt?: unknown } | null;
  const draftId = typeof input?.draftId === "string" ? input.draftId : "";
  const scheduledAt = typeof input?.scheduledAt === "string" ? input.scheduledAt : "";
  const platform = socialPlatformSchema.safeParse(input?.platform);
  if (!draftId || !scheduledAt || !platform.success) {
    return NextResponse.json(
      {
        error: `A schedule needs a draft id, an instant with an offset, and a platform (${socialPlatformSchema.options.join(", ")}).`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await scheduleApprovedDraft(
      { ctx, repos },
      { draftId, platform: platform.data, scheduledAt },
      new Date(),
    );
    return NextResponse.json({ row: toWire(result.row), created: result.created });
  } catch (err) {
    return queueErrorResponse(err);
  }
}

/**
 * The operator's un-schedule. Only a row that has not been claimed can be
 * withdrawn — mid-flight is not a decision still available — and the repo's
 * rulebook is what enforces that, not this route.
 */
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) {
    return NextResponse.json({ error: "Name the queue row to cancel." }, { status: 400 });
  }

  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }

  try {
    return NextResponse.json({ row: toWire(await repos.publishQueue.cancel(ctx, id)) });
  } catch (err) {
    return queueErrorResponse(err);
  }
}
