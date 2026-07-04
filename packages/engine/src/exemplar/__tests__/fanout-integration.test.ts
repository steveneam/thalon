import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, InvalidTransitionError, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { runFanout } from "../../fanout/fanout";
import {
  createFakeDraftGeneratorDriver,
  type DraftGeneratorDriver,
} from "../../fanout/shell/generator";
import { createFakeEmbeddingDriver, type EmbeddingDriver } from "../../ingest/shell/embedder";
import { ingestExemplar } from "../ingest-exemplar";

const EXEMPLAR_TEXT =
  "Our repair clinic keeps usable gear out of landfill every single month, rain or shine.";

let handle: DbHandle | undefined;
let storeRoot: string | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  if (storeRoot) {
    rmSync(storeRoot, { recursive: true, force: true });
    storeRoot = undefined;
  }
});

async function setup(): Promise<{
  ctx: TenantCtx;
  repos: Repos;
  sourceId: string;
  objectStore: LocalObjectStore;
  embedder: EmbeddingDriver;
}> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { voice: { register: "plain" }, denylist: [], platformProfiles: {} },
    activate: true,
  });
  const { source } = await repos.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("a launch announcement"),
    chunks: [
      {
        seq: 0,
        text: "We shipped a major feature today.",
        tokenCount: 6,
        contentHash: sha256Hex("chunk-0"),
      },
    ],
  });
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-fanout-exemplar-"));
  const objectStore = new LocalObjectStore(storeRoot);
  const embedder = createFakeEmbeddingDriver(1536);
  return { ctx, repos, sourceId: source.id, objectStore, embedder };
}

/** Returns req.exemplarContext verbatim as the draft body — deliberately reuses exemplar phrasing to exercise the overlap gate end-to-end. */
function verbatimReuseDriver(): DraftGeneratorDriver {
  return async (req) => {
    const body = `[${req.platform}] ${req.exemplarContext ?? req.sourceText}`.slice(0, 500);
    return { candidate: { body }, tokensIn: 5, tokensOut: 5 };
  };
}

describe("runFanout — exemplar-aware wiring (B2.4, keyless + networkless)", () => {
  it("is opt-in only: a plain fan-out on a tenant that HAS exemplar sources records no exemplarIds", async () => {
    const { ctx, repos, sourceId, objectStore, embedder } = await setup();
    await ingestExemplar(
      ctx,
      repos,
      { kind: "exemplar", text: EXEMPLAR_TEXT },
      { embedder, objectStore, capTokens: 1_000_000 },
    );

    const result = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"] },
      { driver: createFakeDraftGeneratorDriver(), capTokens: 1_000_000 },
    );
    const meta = result.drafts[0].meta as Record<string, unknown>;
    expect(meta.exemplarIds).toBeUndefined();
  });

  it("records exemplar provenance on the run and every draft, with a generation key distinct from a plain run", async () => {
    const { ctx, repos, sourceId, objectStore, embedder } = await setup();
    const exemplar = await ingestExemplar(
      ctx,
      repos,
      { kind: "exemplar", text: EXEMPLAR_TEXT },
      { embedder, objectStore, capTokens: 1_000_000 },
    );
    const exemplarChunks = await repos.sourceChunks.listBySource(ctx, exemplar.sourceId);

    const plain = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"] },
      { driver: createFakeDraftGeneratorDriver(), capTokens: 1_000_000 },
    );

    const aware = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"], exemplar: { k: 5 } },
      {
        driver: createFakeDraftGeneratorDriver(),
        capTokens: 1_000_000,
        exemplarEmbedder: embedder,
        exemplarObjectStore: objectStore,
      },
    );

    // Distinct generation key -> distinct run: no fast-path collision between
    // a plain run and an exemplar-aware run sharing every other input.
    expect(aware.runId).not.toBe(plain.runId);

    const meta = aware.drafts[0].meta as Record<string, unknown>;
    expect(meta.exemplarIds).toEqual([
      { sourceId: exemplar.sourceId, chunkId: exemplarChunks[0].id },
    ]);

    const run = await repos.fanoutRuns.get(ctx, aware.runId);
    expect(run?.params).toEqual({
      exemplarIds: [{ sourceId: exemplar.sourceId, chunkId: exemplarChunks[0].id }],
    });
  });

  it("replays idempotently: the same exemplar-aware request twice does not duplicate the run or re-generate", async () => {
    const { ctx, repos, sourceId, objectStore, embedder } = await setup();
    await ingestExemplar(
      ctx,
      repos,
      { kind: "exemplar", text: EXEMPLAR_TEXT },
      { embedder, objectStore, capTokens: 1_000_000 },
    );

    const calls: string[] = [];
    const countingDriver: DraftGeneratorDriver = (req) => {
      calls.push(req.platform);
      return createFakeDraftGeneratorDriver()(req);
    };
    const deps = {
      driver: countingDriver,
      capTokens: 1_000_000,
      exemplarEmbedder: embedder,
      exemplarObjectStore: objectStore,
    };

    const first = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"], exemplar: { k: 5 } },
      deps,
    );
    expect(first.created).toBe(true);
    expect(calls).toHaveLength(1);

    const second = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"], exemplar: { k: 5 } },
      deps,
    );
    expect(second.created).toBe(false);
    expect(second.runId).toBe(first.runId);
    expect(calls).toHaveLength(1); // no new generation calls on replay
    expect(second.drafts.map((d) => d.id)).toEqual(first.drafts.map((d) => d.id));
  });

  it("the overlap gate blocks a verbatim-reuse draft end-to-end — it can never reach queued", async () => {
    const { ctx, repos, sourceId, objectStore, embedder } = await setup();
    await ingestExemplar(
      ctx,
      repos,
      { kind: "exemplar", text: EXEMPLAR_TEXT },
      { embedder, objectStore, capTokens: 1_000_000 },
    );

    const result = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"], exemplar: { k: 5 } },
      {
        driver: verbatimReuseDriver(),
        capTokens: 1_000_000,
        exemplarEmbedder: embedder,
        exemplarObjectStore: objectStore,
      },
    );

    const draftId = result.drafts[0].id;
    const draft = await repos.drafts.get(ctx, draftId);
    expect(draft.status).toBe("blocked");

    const judgeRows = await repos.judgeResults.listForDraft(ctx, draftId);
    expect(judgeRows.map((r) => r.gate)).toContain("exemplar_overlap");

    await expect(repos.drafts.transition(ctx, draftId, "queued")).rejects.toThrow(
      InvalidTransitionError,
    );
  });
});
