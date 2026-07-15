import type { Draft, JudgeResult, Source } from "@thalon/db";
import { describe, expect, it } from "vitest";
import { toAsset } from "../plan";

const T0 = new Date("2026-07-14T09:00:00.000Z");
const T1 = new Date("2026-07-14T09:05:00.000Z");
const T2 = new Date("2026-07-14T10:00:00.000Z");

function draft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: "d1",
    tenantId: "t1",
    fanoutRunId: "run-1",
    sourceId: "s1",
    platform: "linkedin",
    format: null,
    body: "body",
    bodyHash: "h1",
    meta: {},
    status: "queued",
    generationKey: "g-d1",
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  } as Draft;
}

function judge(gate: string, verdict: string, bodyHash: string, createdAt: Date, evidence: unknown = { claims: [] }): JudgeResult {
  return {
    id: `${gate}-${createdAt.toISOString()}`,
    tenantId: "t1",
    draftId: "d1",
    gate,
    verdict,
    bodyHash,
    evidence,
    model: null,
    promptVersion: null,
    latencyMs: null,
    createdAt,
  } as JudgeResult;
}

const source = {
  id: "s1",
  kind: "url",
  createdAt: new Date("2026-07-14T08:00:00.000Z"),
} as Source;

describe("toAsset (lineage derivation)", () => {
  it("derives stage instants honestly: only verdicts for the CURRENT hash count as judged", () => {
    const asset = toAsset(
      draft(),
      [judge("g1", "pass", "stale-hash", T2), judge("g1", "pass", "h1", T1)],
      source,
    );
    expect(asset.judgedAt).toBe(T1.toISOString());
    expect(asset.gates).toEqual([{ gate: "g1", verdict: "pass" }]);
    expect(asset.decidedAt).toBeNull();
    expect(asset.publishedAt).toBeNull();
    expect(asset.capturedAt).toBe("2026-07-14T08:00:00.000Z");
  });

  it("an undecided draft never fabricates a decision; a decided one stamps the transition instant", () => {
    expect(toAsset(draft({ status: "judging" }), [], null).decidedAt).toBeNull();
    const decided = toAsset(draft({ status: "approved", updatedAt: T2 }), [], null);
    expect(decided.decidedAt).toBe(T2.toISOString());
  });

  it("published truth comes from the deploy meta the engine recorded, never from status alone", () => {
    const deployed = toAsset(
      draft({
        status: "approved",
        updatedAt: T2,
        meta: { deployStatus: "deployed", deployRef: "/blog/post" },
      }),
      [],
      null,
    );
    expect(deployed.publishedAt).toBe(T2.toISOString());
    expect(deployed.deployRef).toBe("/blog/post");

    const failed = toAsset(
      draft({ status: "approved", updatedAt: T2, meta: { deployStatus: "failed", deployRef: null } }),
      [],
      null,
    );
    expect(failed.publishedAt).toBeNull();
    expect(failed.deployRef).toBeNull();
  });

  it("carries plain-language reasons for a blocked draft from the judge evidence", () => {
    const asset = toAsset(
      draft({ status: "blocked" }),
      [
        judge("g3_final", "fail", "h1", T1, {
          claims: [{ claim: "Ships everywhere", verdict: "fail", evidence: "no source supports it" }],
        }),
      ],
      source,
    );
    expect(asset.reasons).toEqual(["Grounding — final: Ships everywhere — no source supports it"]);
  });
});
