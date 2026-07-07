import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeEmbeddingDriver } from "../../ingest/shell/embedder";
import { createFakeWebPageDriver } from "../../webpage/shell/generator";
import {
  composePageBrief,
  pageLoopBriefVersion,
  pageLoopContextSchema,
  runPageLoop,
} from "../page-loop";

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

const FULL_CONTEXT = {
  kind: "trend_promote",
  family: "page",
  title: "Deterministic pipelines beat vibes",
  angle: "why replayable content generation wins",
  hook: "Same input, same output — every time.",
  sourceUrl: "https://example.com/post/1",
  areaName: "AI video tooling",
  keyword: "deterministic content pipeline",
  score: 0.7523,
  text: "Everyone is rebuilding their content stack around replayable runs.",
} as const;

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos; objectStore: LocalObjectStore }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { voice: { register: "plain" }, denylist: [], platformProfiles: {} },
    activate: true,
  });
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-page-loop-"));
  return { ctx, repos, objectStore: new LocalObjectStore(storeRoot) };
}

describe("composePageBrief (deterministic template render)", () => {
  it("renders every context key once, drops the template comment, and is stable across calls", () => {
    const context = pageLoopContextSchema.parse(FULL_CONTEXT);
    const brief = composePageBrief(context);

    expect(brief).toContain("originated from a promoted trend card");
    expect(brief).toContain("Working title: Deterministic pipelines beat vibes");
    expect(brief).toContain("Angle: why replayable content generation wins");
    expect(brief).toContain("Opening hook: Same input, same output — every time.");
    expect(brief).toContain('Monitored area: AI video tooling');
    expect(brief).toContain("Target keyword: deterministic content pipeline");
    expect(brief).toContain("Intel rank score: 0.7523");
    expect(brief).toContain("not a fact source): Everyone is rebuilding");
    expect(brief).toContain("Source URL (provenance only): https://example.com/post/1");
    expect(brief).not.toContain("<!--");
    expect(brief).not.toContain("{{");
    expect(composePageBrief(context)).toBe(brief); // byte-stable replay
  });

  it("drops whole lines for absent optional keys — no orphaned labels, no blank-run residue", () => {
    const context = pageLoopContextSchema.parse({
      kind: "search_target_this",
      family: "page",
      keyword: "answer engine optimization",
    });
    const brief = composePageBrief(context);

    expect(brief).toContain("originated from a targeted search opportunity");
    expect(brief).toContain("Target keyword: answer engine optimization");
    expect(brief).not.toContain("Working title:");
    expect(brief).not.toContain("Angle:");
    expect(brief).not.toContain("Opening hook:");
    expect(brief).not.toContain("Source URL");
    expect(brief).not.toMatch(/\n{3,}/);
  });

  it("strips web-side extras (captureId) and refuses non-page families loudly", () => {
    const parsed = pageLoopContextSchema.parse({ ...FULL_CONTEXT, captureId: "cap-1" });
    expect("captureId" in parsed).toBe(false);
    expect(() => pageLoopContextSchema.parse({ ...FULL_CONTEXT, family: "video" })).toThrow();
  });
});

describe("runPageLoop (B6.6 intel context -> web_page draft, keyless + networkless)", () => {
  it("ingests the brief as a prompt source and drives web-page generation to a generated draft", async () => {
    const { ctx, repos, objectStore } = await setup();

    const result = await runPageLoop(
      ctx,
      repos,
      { context: FULL_CONTEXT },
      { driver: createFakeWebPageDriver(), embedder: createFakeEmbeddingDriver(), objectStore },
    );

    expect(result.created).toBe(true);
    expect(result.briefVersion).toBe(pageLoopBriefVersion());
    expect(result.draft.format).toBe("web_page");
    expect(result.draft.status).toBe("generated"); // the judge harness is the only path onward

    const promptSource = await repos.sources.get(ctx, result.promptSourceId);
    expect(promptSource?.kind).toBe("prompt");
    expect((promptSource?.meta as Record<string, unknown>).briefVersion).toBe("page-loop-brief.v1");
    expect((promptSource?.meta as Record<string, unknown>).intelKind).toBe("trend_promote");

    const meta = result.draft.meta as Record<string, unknown>;
    expect(meta.groundingSourceIds).toEqual([result.promptSourceId]);
  });

  it("replays instead of duplicating: the same context lands on the same source and draft", async () => {
    const { ctx, repos, objectStore } = await setup();
    const deps = {
      driver: createFakeWebPageDriver(),
      embedder: createFakeEmbeddingDriver(),
      objectStore,
    };

    const first = await runPageLoop(ctx, repos, { context: FULL_CONTEXT }, deps);
    const second = await runPageLoop(ctx, repos, { context: FULL_CONTEXT }, deps);

    expect(second.promptSourceId).toBe(first.promptSourceId);
    expect(second.created).toBe(false);
    expect(second.draft.id).toBe(first.draft.id);
  });

  it("passes grounding sources through to the generation (meta + judge surface)", async () => {
    const { ctx, repos, objectStore } = await setup();
    const grounding = await repos.sourceChunks.ingest(ctx, {
      kind: "doc",
      contentHash: "site-facts-hash",
      chunks: [{ seq: 0, text: "The engine judges every draft.", tokenCount: 5, contentHash: "c0" }],
    });

    const result = await runPageLoop(
      ctx,
      repos,
      { context: FULL_CONTEXT, groundingSourceIds: [grounding.source.id] },
      { driver: createFakeWebPageDriver(), embedder: createFakeEmbeddingDriver(), objectStore },
    );

    const meta = result.draft.meta as Record<string, unknown>;
    expect(meta.groundingSourceIds).toEqual([result.promptSourceId, grounding.source.id]);
  });
});
