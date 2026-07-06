/**
 * Wire types for the workspace shell/dashboard reads (B6.2). Dates cross the
 * wire as ISO strings (the lib/approve-queue/types.ts convention). All three
 * endpoints are thin reads over repos/platform — no engine dependency
 * (SPINE §5 lane doctrine).
 */

export interface PulseCounts {
  /** Fan-out runs in the feed window (fanoutRuns.list cap). */
  runs: number;
  /** Runs carrying a recorded lastError — the triage signal. */
  runsWithErrors: number;
  /** All drafts across the feed-window runs. */
  drafts: number;
  /** Waiting on the operator: judge-passed, unreviewed. */
  queued: number;
  /** Waiting on the operator: judge-blocked, needs edit/re-judge. */
  blocked: number;
  approved: number;
}

export interface WorkspacePulse {
  /** null = the configured demo tenant is not seeded yet (fresh dev db) — the first-run state. */
  tenant: { slug: string; name: string } | null;
  /** The active brand-profile version, when one exists. */
  profile: { version: number; company: string | null } | null;
  counts: PulseCounts;
  /** queued + blocked — the one number the shell badge and needs-you card show. */
  needsYou: number;
}

export interface ActivityItem {
  /** The event row's seq — stable, unique per tenant. */
  id: number;
  event: string;
  entityType: string;
  entityId: string;
  at: string;
  payload: Record<string, unknown>;
}

/** Mirrors @thalon/platform resolveSeams() — names, never key material. */
export interface SeamReadout {
  db: string;
  objectStore: string;
  queue: string;
  auth: string;
  gateway: "configured" | "unconfigured";
  tracing: "configured" | "unconfigured";
  dataDir: string;
}

export interface WorkspaceStatus {
  seams: SeamReadout;
  /** The env-selected driver per registry seam (the packages/platform choke point) — read-only display. */
  drivers: { render: string; transcript: string; searchIntel: string };
  models: { draft: string; judgeScreen: string; judgeFinal: string; embedding: string };
  budget: { tenantDailyTokens: number };
  tenantSlug: string;
}
