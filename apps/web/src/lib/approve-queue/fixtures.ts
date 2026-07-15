import type { DraftDetail, FeedRun, GridDraft, PanelJudgeResult } from "./types";

/**
 * Typed fixture data for the mock seam (see notes in components/approve — MSW
 * intercepts fetch in dev/tests so UI work never depends on a live engine or
 * judge lane). Shapes mirror the wire types exactly, not the db row types.
 */
export const FIXTURE_RUN_1_ID = "11111111-1111-1111-1111-111111111111";
export const FIXTURE_RUN_2_ID = "22222222-2222-2222-2222-222222222222";
export const FIXTURE_DRAFT_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // run 2, linkedin, gates pass
export const FIXTURE_DRAFT_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // run 2, x, tier disagreement
export const FIXTURE_DRAFT_C_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // run 1, linkedin, approved

export function run(id: string, createdAt: string, draftsComplete = true): FeedRun {
  return {
    id,
    tenantId: "tenant-fixture",
    sourceId: `source-${id}`,
    brandProfileId: `profile-${id}`,
    brandProfileVersion: 1,
    platforms: ["linkedin", "x"],
    promptVersion: "fanout.v1",
    model: "test/model",
    params: {},
    generationKey: `gen-${id}`,
    status: "complete",
    lastError: null,
    createdAt,
    draftsComplete,
  };
}

export function draft(
  id: string,
  runId: string,
  platform: string,
  body: string,
  status: string,
  bodyHash: string,
  extra: { format?: string | null; meta?: Record<string, unknown> } = {},
): GridDraft {
  return {
    id,
    tenantId: "tenant-fixture",
    fanoutRunId: runId,
    sourceId: `source-${runId}`,
    platform,
    format: extra.format ?? null,
    body,
    bodyHash,
    meta: extra.meta ?? {},
    status,
    generationKey: `gen-${id}`,
    createdAt: "2026-07-04T09:00:00.000Z",
    updatedAt: "2026-07-04T09:00:00.000Z",
  };
}

export function verdict(
  gate: string,
  v: "pass" | "fail",
  bodyHash: string,
  evidence: Record<string, unknown> = { claims: [] },
): PanelJudgeResult {
  return {
    id: `${gate}-${bodyHash}`,
    tenantId: "tenant-fixture",
    draftId: "",
    gate,
    verdict: v,
    bodyHash,
    evidence,
    model: "test/model",
    promptVersion: "judge.v1",
    latencyMs: 120,
    createdAt: "2026-07-04T09:05:00.000Z",
  };
}

export const fixtureRuns: FeedRun[] = [
  run(FIXTURE_RUN_2_ID, "2026-07-04T09:00:00.000Z"),
  run(FIXTURE_RUN_1_ID, "2026-07-03T09:00:00.000Z"),
];

export const draftA = draft(FIXTURE_DRAFT_A_ID, FIXTURE_RUN_2_ID, "linkedin", "Run2 LinkedIn draft", "queued", "hash-a");
export const draftB = draft(FIXTURE_DRAFT_B_ID, FIXTURE_RUN_2_ID, "x", "Run2 X draft", "blocked", "hash-b");
export const draftC = draft(FIXTURE_DRAFT_C_ID, FIXTURE_RUN_1_ID, "linkedin", "Run1 LinkedIn draft", "approved", "hash-c");

export const fixtureDraftsByRun: Record<string, GridDraft[]> = {
  [FIXTURE_RUN_2_ID]: [draftA, draftB],
  [FIXTURE_RUN_1_ID]: [draftC],
};

export const fixtureDraftDetails: Record<string, DraftDetail> = {
  [FIXTURE_DRAFT_A_ID]: {
    draft: draftA,
    judgeResults: [verdict("g1", "pass", "hash-a"), verdict("g3_screen", "pass", "hash-a"), verdict("g3_final", "pass", "hash-a")],
  },
  [FIXTURE_DRAFT_B_ID]: {
    draft: draftB,
    judgeResults: [
      verdict("g1", "pass", "hash-b"),
      verdict("g3_screen", "pass", "hash-b"),
      // The failing tier carries per-claim evidence (contracts judgeEvidenceSchema)
      // — what the JudgeReasons block renders as the plain-language why.
      verdict("g3_final", "fail", "hash-b", {
        claims: [
          {
            claim: "Works with every platform",
            verdict: "fail",
            evidence: "no provided source supports this claim",
          },
        ],
      }),
    ],
  },
  [FIXTURE_DRAFT_C_ID]: { draft: draftC, judgeResults: [] },
};
