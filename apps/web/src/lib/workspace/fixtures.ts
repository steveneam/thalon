import type { ActivityItem, PipelineAsset, PlanPayload, WorkspacePulse, WorkspaceStatus } from "./types";

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

/**
 * Plan fixture (dashboard v3): instants are computed RELATIVE to load time so
 * the dev calendar always has something in the visible week — component tests
 * assert presence/copy, never exact dates; the pure week/pipeline math has its
 * own fixed-clock unit tests.
 */
function fixtureAsset(overrides: Partial<PipelineAsset> & { draftId: string }): PipelineAsset {
  const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
  return {
    runId: "22222222-2222-2222-2222-222222222222",
    platform: "linkedin",
    format: null,
    status: "queued",
    sourceKind: "url",
    capturedAt: twoHoursAgo,
    generatedAt: twoHoursAgo,
    judgedAt: twoHoursAgo,
    decidedAt: null,
    publishedAt: null,
    gates: [
      { gate: "g1", verdict: "pass" },
      { gate: "g3_screen", verdict: "pass" },
      { gate: "g3_final", verdict: "pass" },
    ],
    reasons: [],
    deployRef: null,
    ...overrides,
  };
}

export const fixturePlan: PlanPayload = {
  sweep: {
    lastSweptAt: new Date(Date.now() - 3_600_000).toISOString(),
    nextSweepAt: new Date(Date.now() + 3 * 3_600_000).toISOString(),
    intervalMs: 4 * 3_600_000,
    source: "bluesky",
  },
  areas: 2,
  cadence: [
    { platform: "linkedin", maxPerDay: 1, maxPerWeek: 5 },
    { platform: "email", maxPerDay: 2, minGapMinutes: 240 },
  ],
  assets: [
    fixtureAsset({ draftId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", platform: "linkedin" }),
    fixtureAsset({
      draftId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      platform: "x",
      status: "blocked",
      gates: [
        { gate: "g1", verdict: "pass" },
        { gate: "g3_screen", verdict: "pass" },
        { gate: "g3_final", verdict: "fail" },
      ],
      reasons: ["Grounding — final: Ships every platform — no provided source supports this claim."],
    }),
    fixtureAsset({
      draftId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      runId: "11111111-1111-1111-1111-111111111111",
      status: "approved",
      decidedAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
    }),
    fixtureAsset({
      draftId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      runId: "11111111-1111-1111-1111-111111111111",
      platform: "web",
      format: "web_page",
      status: "approved",
      decidedAt: new Date(Date.now() - 20 * 3_600_000).toISOString(),
      publishedAt: new Date(Date.now() - 19 * 3_600_000).toISOString(),
      deployRef: "/blog/fixture-post",
    }),
  ],
};

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
