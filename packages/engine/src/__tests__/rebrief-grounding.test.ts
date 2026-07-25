import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { storyboardDraftMetaSchema, tenantCtx, type TenantCtx } from "@thalon/contracts";
import {
  openTestDb,
  sha256Hex,
  stableStringify,
  type DbHandle,
  type Repos,
} from "@thalon/db";
import { collectGroundingChunks } from "@thalon/judge";
import { LocalObjectStore, modelTiers } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeStoryboardStageDriver } from "../direction/shell/generator";
import { runOrigination } from "../origination/origination";
import { pillarScriptDraftMetaSchema } from "../origination/schemas";
import {
  createFakePillarScriptDriver,
  type PillarScriptDriver,
} from "../origination/shell/generator";
import { startVideoStages } from "../pipeline/staged-video";
import { webPageDraftMetaSchema } from "../webpage/schemas";
import { createFakeWebPageDriver } from "../webpage/shell/generator";
import { runWebPageGeneration } from "../webpage/webpage";

/**
 * THE 491089d0 RATCHET (s69 root cause, made executable): a re-brief
 * REPLACES the grounding pointer — it never appends. Draft 491089d0's
 * twelve-lap judge record traced to `meta.groundingSourceIds` carrying BOTH
 * the original brief and the re-brief (near-identical instruction texts,
 * delta = one attestation block); two ~same briefs in the judged context
 * destabilize the final tier. The natural re-brief flow carries the prior
 * draft's grounding set forward verbatim — old brief included — so the ONE
 * grounding resolver (pipeline/grounding-set.ts) strips every prompt-kind
 * source from the requested set at all three brief-fed entry points: the
 * current brief is the only brief a draft ever grounds against.
 */

const BRIEF_V1 = "Make a pillar video introducing what the product does.";
const BRIEF_V2 = `${BRIEF_V1}\n\nOperator attestation: the workflow shown is our own daily use.`;

let handle: DbHandle | undefined;
const storeRoots: string[] = [];

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  for (const root of storeRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function newStore(tag: string): LocalObjectStore {
  const root = mkdtempSync(path.join(tmpdir(), `thalon-rebrief-${tag}-`));
  storeRoots.push(root);
  return new LocalObjectStore(root);
}

async function db(): Promise<{
  ctx: TenantCtx;
  repos: Repos;
  profile: { id: string; version: number };
}> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  const profile = await repos.brandProfiles.create(ctx, {
    config: { voice: { register: "plain" }, denylist: [], platformProfiles: {} },
    activate: true,
  });
  return { ctx, repos, profile };
}

async function ingestBrief(ctx: TenantCtx, repos: Repos, text: string): Promise<string> {
  const { source } = await repos.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex(text),
    chunks: [
      {
        seq: 0,
        text,
        tokenCount: Math.ceil(text.length / 4),
        contentHash: sha256Hex(`0:${text}`),
      },
    ],
  });
  return source.id;
}

async function ingestDoc(ctx: TenantCtx, repos: Repos, tag: string): Promise<string> {
  const { source } = await repos.sourceChunks.ingest(ctx, {
    kind: "doc",
    contentHash: sha256Hex(`rebrief doc ${tag}`),
    chunks: [
      {
        seq: 0,
        text: `Fact ${tag}: the product turns one source into judged platform drafts.`,
        tokenCount: 12,
        contentHash: sha256Hex(`rebrief-doc-${tag}`),
      },
    ],
  });
  return source.id;
}

describe("re-brief grounding replacement (the 491089d0 ratchet)", () => {
  it("origination: a re-brief carrying the prior draft's grounding set forward REPLACES the old brief — meta, judge context, run key, and replay all see exactly one brief", async () => {
    const { ctx, repos, profile } = await db();
    const briefV1 = await ingestBrief(ctx, repos, BRIEF_V1);
    const facts = await ingestDoc(ctx, repos, "pillar");

    const first = await runOrigination(
      ctx,
      repos,
      { promptSourceId: briefV1, groundingSourceIds: [facts] },
      { driver: createFakePillarScriptDriver(), capTokens: 1_000_000 },
    );
    const firstMeta = pillarScriptDraftMetaSchema.parse(first.draft.meta);
    expect(firstMeta.groundingSourceIds).toEqual([briefV1, facts]);

    // The incident's exact shape: the re-brief run reuses the prior draft's
    // FULL grounding set — the old brief rides in the request.
    const briefV2 = await ingestBrief(ctx, repos, BRIEF_V2);
    const rebrief = await runOrigination(
      ctx,
      repos,
      { promptSourceId: briefV2, groundingSourceIds: firstMeta.groundingSourceIds },
      { driver: createFakePillarScriptDriver(), capTokens: 1_000_000 },
    );
    const rebriefMeta = pillarScriptDraftMetaSchema.parse(rebrief.draft.meta);
    // REPLACE semantics: the new brief is THE brief; the old brief is gone,
    // the non-brief grounding stays.
    expect(rebriefMeta.groundingSourceIds).toEqual([briefV2, facts]);

    // No near-duplicate brief text reaches the judge context: exactly ONE
    // chunk carries the brief wording, and it is the re-brief's superset text.
    const chunks = await collectGroundingChunks(ctx, repos, rebrief.draft);
    const briefChunks = chunks.filter((c) => c.text.includes("introducing what the product does"));
    expect(briefChunks).toHaveLength(1);
    expect(briefChunks[0].text).toContain("Operator attestation");

    // The run key is computed from the REPLACED set (pinned bytes, mirrors
    // key-stability): replacing changes the key vs the appended shape — that
    // is CORRECT behavior — and a stale-carry request and a clean request
    // resolve to the SAME run.
    const expectedRunKey = sha256Hex(
      stableStringify({
        tenantId: ctx.tenantId,
        promptSourceId: briefV2,
        groundingSourceIds: [facts],
        brandProfileId: profile.id,
        brandProfileVersion: profile.version,
        platform: "video",
        promptVersion: "pillar-script-generate.v1",
        model: modelTiers().draft,
      }),
    );
    const run = await repos.fanoutRuns.getByGenerationKey(ctx, expectedRunKey);
    expect(run?.id).toBe(rebrief.runId);
    // The replacement is never silent: run provenance names what the current
    // brief replaced.
    expect(run?.params).toMatchObject({
      groundingSourceIds: [facts],
      replacedBriefSourceIds: [briefV1],
    });

    // Idempotent replay: the CLEAN re-brief request (no stale carry) hits the
    // same generation key — same draft, zero shell calls.
    let calls = 0;
    const counting: PillarScriptDriver = (req) => {
      calls++;
      return createFakePillarScriptDriver()(req);
    };
    const replay = await runOrigination(
      ctx,
      repos,
      { promptSourceId: briefV2, groundingSourceIds: [facts] },
      { driver: counting, capTokens: 1_000_000 },
    );
    expect(replay.created).toBe(false);
    expect(replay.draft.id).toBe(rebrief.draft.id);
    expect(calls).toBe(0);
  });

  it("startVideoStages: the staged chain's stage-0 grounding set gets the same replacement — the set every later stage carries forward", async () => {
    const { ctx, repos } = await db();
    const briefV1 = await ingestBrief(ctx, repos, BRIEF_V1);
    const facts = await ingestDoc(ctx, repos, "staged");

    const first = await startVideoStages(
      ctx,
      repos,
      { promptSourceId: briefV1, groundingSourceIds: [facts] },
      { structureDriver: createFakeStoryboardStageDriver(), capTokens: 1_000_000 },
    );
    const firstMeta = storyboardDraftMetaSchema.parse(first.draft.meta);
    expect(firstMeta.groundingSourceIds).toEqual([briefV1, facts]);

    const briefV2 = await ingestBrief(ctx, repos, BRIEF_V2);
    const rebrief = await startVideoStages(
      ctx,
      repos,
      { promptSourceId: briefV2, groundingSourceIds: firstMeta.groundingSourceIds },
      { structureDriver: createFakeStoryboardStageDriver(), capTokens: 1_000_000 },
    );
    const rebriefMeta = storyboardDraftMetaSchema.parse(rebrief.draft.meta);
    expect(rebriefMeta.groundingSourceIds).toEqual([briefV2, facts]);
  });

  it("runWebPageGeneration: the same replacement at the web-page brief door", async () => {
    const { ctx, repos } = await db();
    const objectStore = newStore("web");
    const briefV1 = await ingestBrief(ctx, repos, BRIEF_V1);
    const facts = await ingestDoc(ctx, repos, "web");

    const first = await runWebPageGeneration(
      ctx,
      repos,
      { promptSourceId: briefV1, groundingSourceIds: [facts] },
      { driver: createFakeWebPageDriver(), objectStore, capTokens: 1_000_000 },
    );
    const firstMeta = webPageDraftMetaSchema.parse(first.draft.meta);
    expect(firstMeta.groundingSourceIds).toEqual([briefV1, facts]);

    const briefV2 = await ingestBrief(ctx, repos, BRIEF_V2);
    const rebrief = await runWebPageGeneration(
      ctx,
      repos,
      { promptSourceId: briefV2, groundingSourceIds: firstMeta.groundingSourceIds },
      { driver: createFakeWebPageDriver(), objectStore, capTokens: 1_000_000 },
    );
    const rebriefMeta = webPageDraftMetaSchema.parse(rebrief.draft.meta);
    expect(rebriefMeta.groundingSourceIds).toEqual([briefV2, facts]);
  });

  it("the current brief's own id echoed back in the requested grounding set never duplicates it — the brief appears exactly once, at the head", async () => {
    const { ctx, repos } = await db();
    const brief = await ingestBrief(ctx, repos, BRIEF_V1);
    const facts = await ingestDoc(ctx, repos, "own-id");

    const result = await runOrigination(
      ctx,
      repos,
      { promptSourceId: brief, groundingSourceIds: [brief, facts] },
      { driver: createFakePillarScriptDriver(), capTokens: 1_000_000 },
    );
    const meta = pillarScriptDraftMetaSchema.parse(result.draft.meta);
    expect(meta.groundingSourceIds).toEqual([brief, facts]);
  });
});
