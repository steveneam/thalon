import { afterEach, describe, expect, it } from "vitest";
import { runJudgePipeline } from "../pipeline";
import type { JudgeModelDriver, JudgeModelRequest, SourceChunkInput } from "../shell/driver";
import { fixedDriver } from "./fake-drivers";
import { judgeFixture, type JudgeFixture } from "./fixtures";

const PASS = {
  verdict: "pass" as const,
  claims: [{ claim: "shipped", supported: true, chunkRef: "c1" }],
};

let fx: JudgeFixture | undefined;
afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

function capturing(captured: JudgeModelRequest[]): JudgeModelDriver {
  const inner = fixedDriver(PASS);
  return async (req) => {
    captured.push(req);
    return inner(req);
  };
}

function identityChunks(chunks: SourceChunkInput[]): SourceChunkInput[] {
  return chunks.filter((c) => c.ref.startsWith("profile:"));
}

describe("judge pipeline identity grounding (B3.8)", () => {
  it("appends the active profile's identity as a grounding chunk for BOTH tiers — no caller involvement", async () => {
    fx = await judgeFixture({
      identity: { company: "Fernwood Outfitters", facts: ["Family-run shop."] },
    });
    const captured: JudgeModelRequest[] = [];
    await runJudgePipeline(fx.handle.repos, {
      ctx: fx.ctx,
      draftId: fx.draft.id,
      chunks: [{ ref: "c1", text: "We shipped a thing today." }],
      screenDriver: capturing(captured),
      finalDriver: capturing(captured),
    });
    expect(captured).toHaveLength(2);
    for (const req of captured) {
      const profileChunks = identityChunks(req.chunks);
      expect(profileChunks).toHaveLength(1);
      expect(profileChunks[0].ref).toBe("profile:v1:identity");
      expect(profileChunks[0].text).toContain("TENANT IDENTITY (operator-asserted):");
      expect(profileChunks[0].text).toContain("COMPANY: Fernwood Outfitters");
      expect(profileChunks[0].text).toContain("- Family-run shop.");
      // The caller's own chunks are untouched, ahead of the identity chunk.
      expect(req.chunks[0]).toEqual({ ref: "c1", text: "We shipped a thing today." });
    }
  });

  it("an identity-less profile appends nothing — tier requests are byte-identical to pre-B3.8", async () => {
    fx = await judgeFixture();
    const captured: JudgeModelRequest[] = [];
    await runJudgePipeline(fx.handle.repos, {
      ctx: fx.ctx,
      draftId: fx.draft.id,
      chunks: [{ ref: "c1", text: "We shipped a thing today." }],
      screenDriver: capturing(captured),
      finalDriver: capturing(captured),
    });
    expect(captured).toHaveLength(2);
    for (const req of captured) {
      expect(identityChunks(req.chunks)).toHaveLength(0);
      expect(req.chunks).toEqual([{ ref: "c1", text: "We shipped a thing today." }]);
    }
  });
});
