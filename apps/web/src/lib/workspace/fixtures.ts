import type { ActivityItem, WorkspacePulse, WorkspaceStatus } from "./types";

/** Deterministic MSW fixtures for the shell/dashboard reads (component dev + tests). */

export const fixturePulse: WorkspacePulse = {
  tenant: { slug: "self", name: "Thalon" },
  profile: { version: 3, company: "Thalon" },
  counts: { runs: 4, runsWithErrors: 1, drafts: 11, queued: 2, blocked: 1, approved: 5 },
  needsYou: 3,
};

const FIXTURE_ACTIVITY_BASE_MS = Date.UTC(2026, 5, 30, 12, 0, 0);

export const fixtureActivity: ActivityItem[] = [
  {
    id: 42,
    event: "draft.transition",
    entityType: "draft",
    entityId: "0b7e6f3a-0000-4000-8000-000000000042",
    at: new Date(FIXTURE_ACTIVITY_BASE_MS + 3_000).toISOString(),
    payload: { from: "judging", to: "queued" },
  },
  {
    id: 41,
    event: "draft.created",
    entityType: "draft",
    entityId: "0b7e6f3a-0000-4000-8000-000000000041",
    at: new Date(FIXTURE_ACTIVITY_BASE_MS + 2_000).toISOString(),
    payload: { platform: "linkedin" },
  },
  {
    id: 40,
    event: "fanout_run.created",
    entityType: "fanout_run",
    entityId: "0b7e6f3a-0000-4000-8000-000000000040",
    at: new Date(FIXTURE_ACTIVITY_BASE_MS + 1_000).toISOString(),
    payload: {},
  },
];

export const fixtureStatus: WorkspaceStatus = {
  seams: {
    db: "pglite",
    objectStore: "local",
    queue: "inline",
    auth: "dev",
    gateway: "unconfigured",
    tracing: "unconfigured",
    dataDir: ".data",
  },
  drivers: { render: "hyperframes", transcript: "caption-file", searchIntel: "fake" },
  models: {
    draft: "meta/llama-3.3-70b",
    judgeScreen: "meta/llama-3.3-70b",
    judgeFinal: "anthropic/claude-sonnet-4.5",
    embedding: "openai/text-embedding-3-small",
  },
  budget: { tenantDailyTokens: 2_000_000 },
  tenantSlug: "self",
};
