import { tenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { demoTenantSlug } from "@/lib/tenant";
import type { PulseCounts, WorkspacePulse } from "./types";

/**
 * The dashboard pulse: counts derived by hydrating the feed-window runs and
 * their drafts through the existing bulk reads (the listRunsFeed pattern —
 * no dedicated count queries exist on the repos yet; at dev scale the
 * feed-window walk is honest and cheap). needs-you = queued + blocked: both
 * states wait on the operator (approve/reject vs edit/re-judge).
 */
const PULSE_RUN_WINDOW = 50;

export const EMPTY_COUNTS: PulseCounts = {
  runs: 0,
  runsWithErrors: 0,
  drafts: 0,
  queued: 0,
  blocked: 0,
  approved: 0,
};

export async function readPulse(repos: Repos): Promise<WorkspacePulse> {
  // Resolves the tenant ROW (not just the ctx) — the shell shows its name.
  // null = unseeded dev db: the dashboard renders the first-run state.
  const tenant = await repos.tenants.getBySlug(demoTenantSlug());
  if (!tenant) {
    return { tenant: null, profile: null, counts: EMPTY_COUNTS, needsYou: 0 };
  }
  const ctx = tenantCtx(tenant.id);
  const profile = await repos.brandProfiles.getActive(ctx);
  const runs = await repos.fanoutRuns.list(ctx, { limit: PULSE_RUN_WINDOW });
  const counts: PulseCounts = {
    ...EMPTY_COUNTS,
    runs: runs.length,
    runsWithErrors: runs.filter((r) => r.lastError !== null).length,
  };
  const draftsPerRun = await Promise.all(runs.map((run) => repos.drafts.listByRun(ctx, run.id)));
  for (const drafts of draftsPerRun) {
    counts.drafts += drafts.length;
    for (const draft of drafts) {
      if (draft.status === "queued") counts.queued += 1;
      else if (draft.status === "blocked") counts.blocked += 1;
      else if (draft.status === "approved") counts.approved += 1;
    }
  }
  const identity = profile?.identity as { company?: unknown } | null;
  return {
    tenant: { slug: tenant.slug, name: tenant.name },
    profile: profile
      ? {
          version: profile.version,
          company: typeof identity?.company === "string" ? identity.company : null,
        }
      : null,
    counts,
    needsYou: counts.queued + counts.blocked,
  };
}
