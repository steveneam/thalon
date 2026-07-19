import { NextResponse } from "next/server";
import { sweepScheduleConfigSchema } from "@thalon/contracts";
import type { SweepScheduleRow } from "@thalon/db";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * The sweep-schedule config door (B-arm.1, Sprint-8 window): GET reads the
 * tenant's one schedule row, PUT upserts it through the repo (contract
 * bounds validated at the door — floor 15 min, ceiling 24 h). No row yet is
 * an honest disabled default, never a fabricated record. The scheduler
 * driver (`scripts/run-sweep-scheduler.ts`) reads what this door writes;
 * `lastSweepAt` is read-only here — only a sweep that actually ran sets it.
 */

interface WireSchedule {
  enabled: boolean;
  cadenceMinutes: number;
  /** null until the scheduler (or Sweep now via the scheduler path) has actually run one. */
  lastSweepAt: string | null;
  /** false while the tenant has never saved a schedule (the defaults shown are the contract's). */
  configured: boolean;
}

const DEFAULTS = sweepScheduleConfigSchema.parse({});

function toWire(row: SweepScheduleRow | null): WireSchedule {
  if (!row) {
    return { ...DEFAULTS, lastSweepAt: null, configured: false };
  }
  return {
    enabled: row.enabled,
    cadenceMinutes: row.cadenceMinutes,
    lastSweepAt: row.lastSweepAt ? row.lastSweepAt.toISOString() : null,
    configured: true,
  };
}

export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    return NextResponse.json({ schedule: toWire(await repos.sweepSchedules.get(ctx)) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PUT(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = sweepScheduleConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "enabled (boolean) and cadenceMinutes (15–1440) are the schedule's shape." },
      { status: 400 },
    );
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const row = await repos.sweepSchedules.upsert(ctx, parsed.data);
    return NextResponse.json({ schedule: toWire(row) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
