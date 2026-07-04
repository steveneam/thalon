import { tenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle } from "@thalon/db";
import { createFakeDraftGeneratorDriver, createFakeEmbeddingDriver } from "@thalon/engine";
import type { JudgeModelDriver } from "@thalon/judge";
import { afterEach, describe, expect, it } from "vitest";
import { runDogfoodSlice, TENANT_ZERO } from "../dogfood";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

/** Deterministic pass verdict for both tiers — keyless and networkless. */
const passJudgeDriver: JudgeModelDriver = async (req) => ({
  candidate: {
    verdict: "pass",
    claims: [
      {
        claim: "the draft's claims match the provided sources",
        supported: true,
        chunkRef: req.chunks[0]?.ref ?? "chunk-0",
      },
    ],
    notes: "deterministic test driver",
  },
  tokensIn: 1,
  tokensOut: 1,
});

function keylessDeps() {
  return {
    embedder: createFakeEmbeddingDriver(),
    draftDriver: createFakeDraftGeneratorDriver(),
    screenDriver: passJudgeDriver,
    finalDriver: passJudgeDriver,
    capTokens: 1_000_000,
  };
}

describe("runDogfoodSlice (B1.5: the whole Sprint-1 vertical in one call, keyless)", () => {
  it("seeds tenant #0 and drives ingest -> fanout -> judge -> queued end to end", async () => {
    handle = await openTestDb();
    const { repos } = handle;

    const result = await runDogfoodSlice(repos, TENANT_ZERO, keylessDeps());

    expect(result.outcomes).toHaveLength(2);
    expect(new Set(result.outcomes.map((o) => o.platform))).toEqual(new Set(["linkedin", "x"]));
    // Both drafts reached "queued" THROUGH the real transition gate — the
    // @thalon/db I1 check demands a passing g3_final verdict for the current
    // body hash, so this asserts the full judge path ran, not just a status.
    for (const outcome of result.outcomes) {
      expect(outcome.status).toBe("queued");
    }

    const ctx = tenantCtx(result.tenantId);
    for (const outcome of result.outcomes) {
      const verdicts = await repos.judgeResults.listForDraft(ctx, outcome.draftId);
      const gates = verdicts.map((v) => v.gate).sort();
      expect(gates).toEqual(["g1", "g3_final", "g3_screen"]);
    }
  });

  it("is an idempotent replay end to end: run twice, one tenant, one run, no re-judging", async () => {
    handle = await openTestDb();
    const { repos } = handle;

    const first = await runDogfoodSlice(repos, TENANT_ZERO, keylessDeps());
    const second = await runDogfoodSlice(repos, TENANT_ZERO, keylessDeps());

    expect(second.tenantId).toBe(first.tenantId);
    expect(second.sourceId).toBe(first.sourceId);
    expect(second.runId).toBe(first.runId);
    // Replay reports the already-judged drafts as they stand instead of re-judging.
    for (const outcome of second.outcomes) {
      expect(outcome.status).toBe("queued");
      expect(outcome.reason).toBe("already judged (replay)");
    }
  });

  it("keeps the gate real: a denylist hit in a generated draft is blocked, never queued", async () => {
    handle = await openTestDb();
    const { repos } = handle;

    const input = {
      ...TENANT_ZERO,
      // The fake generator echoes the source text into the draft body, so a
      // denylisted phrase in the source surfaces in the draft and G1 must
      // block it before a single model call.
      prompt: "This launch is guaranteed to double your reach overnight.",
      platforms: ["linkedin"],
    };
    const result = await runDogfoodSlice(repos, input, keylessDeps());

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0].status).toBe("blocked");
    expect(result.outcomes[0].reason).toBe("g1 denylist fail");
  });
});
