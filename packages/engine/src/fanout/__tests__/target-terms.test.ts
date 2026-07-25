import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { runFanout } from "../fanout";
import type { DraftGeneratorDriver, GenerateDraftRequest } from "../shell/generator";
import { deriveTargetTerms, normalizeTermList, MAX_TARGET_TERMS } from "../target-terms";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

async function setup(
  identity?: Record<string, unknown>,
): Promise<{ ctx: TenantCtx; repos: Repos; sourceId: string }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: {
      voice: { register: "plain" },
      denylist: [],
      platformProfiles: {},
      ...(identity ? { identity } : {}),
    },
    activate: true,
  });
  const { source } = await repos.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("an AI systems brief"),
    chunks: [
      {
        seq: 0,
        text: "Three AI model releases in eight weeks, one project.",
        tokenCount: 9,
        contentHash: sha256Hex("tt-chunk-0"),
      },
    ],
  });
  return { ctx, repos, sourceId: source.id };
}

/** Scripted shell: fixed body + declared canonical entities, capturing every request. */
function declaringDriver(
  shellTerms: string[] | undefined,
  captured: GenerateDraftRequest[] = [],
): DraftGeneratorDriver {
  return async (req) => {
    captured.push(req);
    return {
      candidate: {
        body: `[${req.platform}] AI post body.`,
        ...(shellTerms ? { targetTerms: shellTerms } : {}),
      },
      tokensIn: 4,
      tokensOut: 4,
    };
  };
}

describe("deriveTargetTerms (Phase 2c derivation core)", () => {
  it("merges in priority order — shell entities, then candidates, then topics — primary first", () => {
    expect(
      deriveTargetTerms({
        shellTerms: ["AI", "AI harness"],
        candidateTerms: ["agentic coding"],
        profileTopics: ["automation"],
      }),
    ).toEqual(["AI", "AI harness", "agentic coding", "automation"]);
  });

  it("dedupes case- and punctuation-insensitively (the lens's own normalization), first casing wins", () => {
    expect(
      deriveTargetTerms({
        shellTerms: ["Model-Agnostic", "AI"],
        candidateTerms: ["model agnostic", "ai"],
        profileTopics: ["AI"],
      }),
    ).toEqual(["Model-Agnostic", "AI"]);
  });

  it(`caps at ${MAX_TARGET_TERMS} — priority decides who survives, never stuffing`, () => {
    const derived = deriveTargetTerms({
      shellTerms: ["a", "b", "c", "d", "e"],
      candidateTerms: ["f", "g"],
      profileTopics: ["h"],
    });
    expect(derived).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(derived).toHaveLength(MAX_TARGET_TERMS);
  });

  it("drops blanks and returns [] when every input is empty", () => {
    expect(deriveTargetTerms({ shellTerms: ["  ", "—"], candidateTerms: [], profileTopics: [] })).toEqual([]);
    expect(deriveTargetTerms({})).toEqual([]);
  });

  it("normalizeTermList trims, drops empties, dedupes, preserves order", () => {
    expect(normalizeTermList(["  AI ", "", "ai", "AI harness"])).toEqual(["AI", "AI harness"]);
  });
});

describe("runFanout declares meta.targetTerms (Phase 2c generation side)", () => {
  it("shell-declared entities land first, request candidates and profile topics fill behind, capped", async () => {
    const { ctx, repos, sourceId } = await setup({ topics: ["automation", "AI"] });
    const result = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"], targetTerms: ["agentic coding", "AI harness"] },
      { driver: declaringDriver(["AI", "AI models"]), capTokens: 1_000_000 },
    );

    const meta = result.drafts[0].meta as Record<string, unknown>;
    // Priority: shell entities > intel candidates > identity topics; "AI" deduped.
    expect(meta.targetTerms).toEqual(["AI", "AI models", "agentic coding", "AI harness", "automation"]);
  });

  it("candidates reach the shell request and the run's provenance params", async () => {
    const { ctx, repos, sourceId } = await setup();
    const captured: GenerateDraftRequest[] = [];
    const result = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"], targetTerms: [" AI ", "AI", "agentic coding"] },
      { driver: declaringDriver(undefined, captured), capTokens: 1_000_000 },
    );

    // Normalized once: trimmed + deduped, order preserved.
    expect(captured[0].targetTermCandidates).toEqual(["AI", "agentic coding"]);
    const run = await repos.fanoutRuns.get(ctx, result.runId);
    expect(run?.params).toEqual({ targetTerms: ["AI", "agentic coding"] });
    // Shell declared nothing — the candidates ARE the declared terms.
    const meta = result.drafts[0].meta as Record<string, unknown>;
    expect(meta.targetTerms).toEqual(["AI", "agentic coding"]);
  });

  it("no shell terms, no candidates, no topics ⇒ meta carries NO targetTerms key (lens stays opt-in by data)", async () => {
    const { ctx, repos, sourceId } = await setup();
    const captured: GenerateDraftRequest[] = [];
    const result = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"] },
      { driver: declaringDriver(undefined, captured), capTokens: 1_000_000 },
    );

    expect(captured[0].targetTermCandidates).toBeUndefined();
    const meta = result.drafts[0].meta as Record<string, unknown>;
    expect("targetTerms" in meta).toBe(false);
    const run = await repos.fanoutRuns.get(ctx, result.runId);
    expect(run?.params).toEqual({});
  });

  it("identity topics alone are enough — a topic-bearing tenant's drafts always declare terms", async () => {
    const { ctx, repos, sourceId } = await setup({ topics: ["hiking", "repair"] });
    const result = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"] },
      { driver: declaringDriver(undefined), capTokens: 1_000_000 },
    );
    const meta = result.drafts[0].meta as Record<string, unknown>;
    expect(meta.targetTerms).toEqual(["hiking", "repair"]);
  });

  it("candidates fold into the generation key: differing candidates are different runs, identical ones replay", async () => {
    const { ctx, repos, sourceId } = await setup();
    const first = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"], targetTerms: ["AI"] },
      { driver: declaringDriver(undefined), capTokens: 1_000_000 },
    );
    const different = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"], targetTerms: ["automation"] },
      { driver: declaringDriver(undefined), capTokens: 1_000_000 },
    );
    expect(different.created).toBe(true);
    expect(different.runId).not.toBe(first.runId);

    const replay = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"], targetTerms: ["AI"] },
      { driver: declaringDriver(undefined), capTokens: 1_000_000 },
    );
    expect(replay.created).toBe(false);
    expect(replay.runId).toBe(first.runId);
  });
});
