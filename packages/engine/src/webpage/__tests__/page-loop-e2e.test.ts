import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { runJudgePipeline, type JudgeModelDriver } from "@thalon/judge";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { ingestWebUrl } from "../../ingest/ingest-web-url";
import { createFakeEmbeddingDriver } from "../../ingest/shell/embedder";
import { runPageLoop } from "../../origination/page-loop";
import { readPublishedPosts } from "../posts";
import { publishWebPageToSite } from "../publish";
import { webPageDraftMetaSchema } from "../schemas";
import { createFakeWebPageDriver } from "../shell/generator";

/**
 * The whole B6.6 loop in one keyless walk (workspace-ux-v2 §9): intel
 * context → grounding web-ingest → page draft → judge → operator approve →
 * own-site publish. Every stage is the same library entry point the
 * product uses; this test adds NO pipeline logic — it proves the doors
 * compose.
 */

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

/** Deterministic pass verdict for both tiers — keyless and networkless (the dogfood-slice fixture shape). */
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
  tokensIn: 10,
  tokensOut: 10,
});

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos; objectStore: LocalObjectStore }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { voice: { register: "plain" }, denylist: [], platformProfiles: {} },
    activate: true,
  });
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-page-loop-e2e-"));
  return { ctx, repos, objectStore: new LocalObjectStore(storeRoot) };
}

describe("B6.6 end-to-end: intel context -> judged page -> approve -> own-site publish (keyless)", () => {
  it("walks the full loop and lands the post in the bundle", async () => {
    const { ctx, repos, objectStore } = await setup();
    const embedder = createFakeEmbeddingDriver(1536);
    const NOW = 1_751_900_000_000;

    // Grounding: the operator's docs page through the web-ingest door.
    const grounding = await ingestWebUrl(
      ctx,
      repos,
      { url: "https://example.com/docs" },
      {
        webIngestDriver: {
          name: "fake-web",
          async fetchPage() {
            return { content: "The engine turns one source into judged platform drafts." };
          },
        },
        robotsFetcher: { fetch: async () => ({ status: 404, html: "" }) },
        rateLimiter: { now: () => 0, sleep: async () => {} },
        embedder,
        objectStore,
      },
    );

    // Intel context → generated web_page draft.
    const loop = await runPageLoop(
      ctx,
      repos,
      {
        context: {
          kind: "trend_promote",
          family: "page",
          title: "Judged Pipelines in Production",
          angle: "what an approval gate buys you",
          areaName: "AI video tooling",
          score: 0.81,
        },
        groundingSourceIds: [grounding.sourceId],
      },
      { driver: createFakeWebPageDriver(), embedder, objectStore },
    );
    expect(loop.draft.status).toBe("generated");

    // The EXISTING judge path — no fork.
    const judged = await runJudgePipeline(repos, {
      ctx,
      draftId: loop.draft.id,
      screenDriver: passJudgeDriver,
      finalDriver: passJudgeDriver,
      capTokens: 1_000_000,
    });
    expect(judged.draft.status).toBe("queued");

    // The operator's touch — the one approval door.
    const { draft: approved } = await repos.approvals.record(ctx, {
      draftId: loop.draft.id,
      actor: "test-operator",
      action: "approve",
    });
    expect(approved.status).toBe("approved");

    // The own-site publish door.
    const published = await publishWebPageToSite(
      ctx,
      repos,
      { draftId: loop.draft.id, nowMs: NOW, tags: ["engineering"] },
      { objectStore },
    );
    expect(published.status).toBe("published");
    if (published.status !== "published") throw new Error("unreachable");
    expect(published.url).toBe(`/blog/${published.slug}`);

    const meta = webPageDraftMetaSchema.parse((await repos.drafts.get(ctx, loop.draft.id)).meta);
    expect(meta.deployStatus).toBe("deployed");
    expect(meta.deployRef).toBe(published.url);

    const bundle = await readPublishedPosts(ctx.tenantId, objectStore);
    expect(bundle?.posts).toHaveLength(1);
    expect(bundle?.posts[0]).toMatchObject({
      draftId: loop.draft.id,
      slug: published.slug,
      publishedAtMs: NOW,
      tags: ["engineering"],
      htmlRef: meta.htmlRef,
    });
  });
});
