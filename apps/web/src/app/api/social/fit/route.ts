import { socialPlatformSchema } from "@thalon/contracts";
import { readDraftFitMedia, suggestNextSlot, validateForPlatform } from "@thalon/engine";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * C1 wiring #2 (s82): the fit read behind Approve's fit line and its
 * platform-true preview.
 *
 * WHY THIS IS A ROUTE AND NOT A CLIENT-SIDE FUNCTION. The measurement rule
 * lives ONCE, in the engine (`validateForPlatform`), because the exact same
 * function decides whether the queue producer refuses a schedule. If the
 * card measured the body itself, the preview and the refusal would be two
 * implementations of one rule and would eventually disagree — the operator
 * would be shown a post that fits and then told it does not. The Approve
 * surface is a client component and must not pull the engine package into
 * the browser bundle, so the measurement crosses the wire instead. One
 * rule, one owner, no drift.
 *
 * It is measured on the draft's CURRENT stored body every time, never from
 * the generation-time `meta.platformFit` stamp: an operator edit changes the
 * body, and nothing refreshes that stamp.
 *
 * The suggested slot rides along because it comes from the same read: the
 * operator's existing planned slots and live queue rows, run through the
 * engine's own `suggestNextSlot`, so the Schedule verb opens on a sensible
 * instant derived from their own rhythm rather than an invented default.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const draftId = params.get("draftId") ?? "";
  if (!draftId) {
    return NextResponse.json({ error: "Name the draft to measure." }, { status: 400 });
  }

  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }

  try {
    const draft = await repos.drafts.get(ctx, draftId);
    // The platform to measure against: the caller's, else the draft's own.
    const platform = socialPlatformSchema.safeParse(params.get("platform") ?? draft.platform);
    if (!platform.success) {
      // A fan-out platform outside the social enum (a blog, the site) has no
      // capability row, and inventing one would be the "no limits" answer the
      // matrix exists to prevent. Said plainly rather than guessed.
      return NextResponse.json({
        supported: false,
        platform: draft.platform,
        reason: `"${draft.platform}" is not a social platform the capability matrix covers — there is no ceiling to measure this draft against.`,
      });
    }

    const fit = validateForPlatform({
      platform: platform.data,
      body: draft.body,
      media: readDraftFitMedia(draft.meta),
    });

    // The operator's own rhythm: everything already planned or committed.
    const [slots, queued] = await Promise.all([
      repos.plannedSlots.listRange(ctx, {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      }),
      repos.publishQueue.list(ctx, { status: "pending" }),
    ]);
    const taken = [
      ...slots.map((slot) => slot.scheduledFor),
      ...queued.flatMap((row) => (row.scheduledAt ? [row.scheduledAt] : [])),
    ];

    return NextResponse.json({
      supported: true,
      // `bodyHash` lets a caller tell whether the measurement it is holding
      // still describes the draft in front of it (the judge-verdict I1
      // convention) — the same reason the generation stamp carries one.
      bodyHash: draft.bodyHash,
      fit,
      suggestedAt: suggestNextSlot({ taken, now: new Date() }).toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
