import { NextResponse } from "next/server";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import type { ActivityItem } from "@/lib/workspace/types";

/**
 * Dashboard activity feed: the tail of the events spine, newest first.
 * events.list reads in append (seq-ascending) order with a limit — there is
 * no descending/paged read on the repo yet, so this walks a bounded window
 * and keeps the tail (honest at dev scale; a desc-ordered repo read is a
 * follow-up recorded in the lane wrap).
 */
const SCAN_WINDOW = 500;
const FEED_SIZE = 40;

export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ items: [] });
  const rows = await repos.events.list(ctx, { limit: SCAN_WINDOW });
  const items: ActivityItem[] = rows.slice(-FEED_SIZE).reverse().map((row) => ({
    id: row.seq,
    event: row.event,
    entityType: row.entityType,
    entityId: row.entityId,
    at: row.createdAt.toISOString(),
    payload: (row.payload ?? {}) as Record<string, unknown>,
  }));
  return NextResponse.json({ items });
}
