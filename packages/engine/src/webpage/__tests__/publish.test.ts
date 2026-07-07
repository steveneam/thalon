import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, FINAL_JUDGE_GATE, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Draft, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import {
  postsBundleKey,
  readPublishedPageHtml,
  readPublishedPosts,
  rebuildPostsBundle,
  resolvePostSlug,
  slugifyTitle,
  type PublishedPost,
} from "../posts";
import { publishWebPageToSite } from "../publish";
import { webPageDraftMetaSchema } from "../schemas";

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

const NOW = 1_751_900_000_000;

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos; objectStore: LocalObjectStore }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-publish-"));
  return { ctx, repos, objectStore: new LocalObjectStore(storeRoot) };
}

let draftSeq = 0;

async function approvedWebPageDraft(
  ctx: TenantCtx,
  repos: Repos,
  objectStore: LocalObjectStore,
  opts: { title?: string; approve?: boolean; seo?: Record<string, unknown> } = {},
): Promise<Draft> {
  const n = ++draftSeq;
  const title = opts.title ?? `Post ${n}`;
  const html = `<html lang="en"><head><title>${title}</title></head><body><h1>${title}</h1></body></html>`;
  const htmlRef = `web-pages/${sha256Hex(html)}.html`;
  await objectStore.put(htmlRef, html);
  const profile =
    (await repos.brandProfiles.getActive(ctx)) ??
    (await repos.brandProfiles.create(ctx, {
      config: { voice: {}, denylist: [], platformProfiles: {} },
      activate: true,
    }));
  const source = await repos.sources.create(ctx, { kind: "prompt", contentHash: `brief-${n}` });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["web"],
    promptVersion: "web-page-generate.v1",
    model: "test/model",
    generationKey: `${ctx.tenantId}:publish-run-${n}`,
  });
  const draft = await repos.drafts.create(ctx, {
    fanoutRunId: run.id,
    sourceId: source.id,
    platform: "web",
    body: title,
    format: "web_page",
    generationKey: `${ctx.tenantId}:publish-draft-${n}`,
    meta: webPageDraftMetaSchema.parse({
      title,
      description: `${title} description`,
      htmlRef,
      groundingSourceIds: [source.id],
      promptVersion: "web-page-generate.v1",
      brandProfileVersion: profile.version,
      platformProfileVersion: "web.v1",
      ...(opts.seo ? { seo: opts.seo } : {}),
    }),
  });
  if (!(opts.approve ?? true)) return draft;
  await repos.drafts.transition(ctx, draft.id, "judging");
  await repos.judgeResults.append(ctx, { draftId: draft.id, gate: FINAL_JUDGE_GATE, verdict: "pass" });
  await repos.drafts.transition(ctx, draft.id, "queued");
  return repos.drafts.transition(ctx, draft.id, "approved");
}

describe("slug math (deterministic core)", () => {
  it("slugifies titles and falls back to a draft-keyed slug when nothing survives", () => {
    expect(slugifyTitle("Deterministic Pipelines — Beat Vibes!", "d1")).toBe(
      "deterministic-pipelines-beat-vibes",
    );
    expect(slugifyTitle("¡¡¡", "abcdef1234")).toBe("post-abcdef12");
  });

  it("keeps a republished draft's slug and suffixes fresh collisions", () => {
    const posts = [
      { slug: "hello-world", draftId: "d1" },
      { slug: "hello-world-2", draftId: "d2" },
    ] as PublishedPost[];
    expect(resolvePostSlug("Hello World", "d1", posts)).toBe("hello-world"); // republish: stable
    expect(resolvePostSlug("Hello, world?", "d3", posts)).toBe("hello-world-3"); // fresh: next free suffix
  });
});

describe("publishWebPageToSite (B6.6 own-site publish door, keyless)", () => {
  it("publishes an approved draft: deployStatus/deployRef flip and the posts bundle carries the mini-contract keys", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await approvedWebPageDraft(ctx, repos, objectStore, {
      title: "Own-Site Publishing",
      seo: { targetKeywords: ["own-site publishing"], jsonLdTypes: ["BlogPosting"] },
    });

    const result = await publishWebPageToSite(
      ctx,
      repos,
      { draftId: draft.id, nowMs: NOW, tags: ["engineering"] },
      { objectStore },
    );

    expect(result.status).toBe("published");
    if (result.status !== "published") throw new Error("unreachable");
    expect(result.slug).toBe("own-site-publishing");
    expect(result.url).toBe("/blog/own-site-publishing");

    const meta = webPageDraftMetaSchema.parse((await repos.drafts.get(ctx, draft.id)).meta);
    expect(meta.deployStatus).toBe("deployed");
    expect(meta.deployRef).toBe("/blog/own-site-publishing");

    const bundle = await readPublishedPosts(ctx.tenantId, objectStore);
    expect(bundle).not.toBeNull();
    expect(bundle?.version).toBe(1);
    expect(bundle?.tenantId).toBe(ctx.tenantId);
    expect(bundle?.generatedAtMs).toBe(NOW);
    expect(bundle?.posts).toHaveLength(1);
    const post = bundle!.posts[0];
    expect(post).toMatchObject({
      slug: "own-site-publishing",
      title: "Own-Site Publishing",
      description: "Own-Site Publishing description",
      draftId: draft.id,
      publishedAtMs: NOW,
      tags: ["engineering"],
    });
    expect(post.htmlRef).toBe(meta.htmlRef);
    expect(post.seo?.targetKeywords).toEqual(["own-site publishing"]);
  });

  it("reads null before the first publish (mirrors readSweepBundle)", async () => {
    const { ctx, objectStore } = await setup();
    expect(await readPublishedPosts(ctx.tenantId, objectStore)).toBeNull();
  });

  it("refuses an unapproved draft (the deploy gate) and a non-web_page format, bundle untouched", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await approvedWebPageDraft(ctx, repos, objectStore, { approve: false });
    await expect(
      publishWebPageToSite(ctx, repos, { draftId: draft.id, nowMs: NOW }, { objectStore }),
    ).rejects.toThrow(/ONLY on an "approved" draft/);
    expect(await readPublishedPosts(ctx.tenantId, objectStore)).toBeNull();
  });

  it("second publish of another draft with the SAME title gets a suffixed slug; a republish keeps slug + first-publish time and refreshes tags only when given", async () => {
    const { ctx, repos, objectStore } = await setup();
    const first = await approvedWebPageDraft(ctx, repos, objectStore, { title: "Weekly Notes" });
    const second = await approvedWebPageDraft(ctx, repos, objectStore, { title: "Weekly Notes" });

    const r1 = await publishWebPageToSite(
      ctx,
      repos,
      { draftId: first.id, nowMs: NOW, tags: ["notes"] },
      { objectStore },
    );
    const r2 = await publishWebPageToSite(
      ctx,
      repos,
      { draftId: second.id, nowMs: NOW + 1000 },
      { objectStore },
    );
    expect(r1.status).toBe("published");
    expect(r2.status).toBe("published");
    if (r2.status !== "published") throw new Error("unreachable");
    expect(r2.slug).toBe("weekly-notes-2");

    // Republish draft 1 later, no tags supplied: slug + publishedAtMs stable, prior tags kept.
    const r3 = await publishWebPageToSite(
      ctx,
      repos,
      { draftId: first.id, nowMs: NOW + 5000 },
      { objectStore },
    );
    if (r3.status !== "published") throw new Error("unreachable");
    expect(r3.slug).toBe("weekly-notes");
    const bundle = r3.bundle;
    expect(bundle.generatedAtMs).toBe(NOW + 5000);
    expect(bundle.posts.map((p) => p.slug)).toEqual(["weekly-notes", "weekly-notes-2"]); // oldest-first canonical order
    expect(bundle.posts[0].publishedAtMs).toBe(NOW);
    expect(bundle.posts[0].tags).toEqual(["notes"]);
  });

  it("rebuilds the bundle from deployed drafts when the pointer is lost (tags degrade honestly, seo survives)", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await approvedWebPageDraft(ctx, repos, objectStore, {
      title: "Rebuild Me",
      seo: { targetKeywords: ["rebuild"] },
    });
    await publishWebPageToSite(
      ctx,
      repos,
      { draftId: draft.id, nowMs: NOW, tags: ["ops"] },
      { objectStore },
    );
    await objectStore.delete(postsBundleKey(ctx.tenantId)); // the disaster

    const rebuilt = await rebuildPostsBundle(ctx, repos, { nowMs: NOW + 9000 }, { objectStore });

    expect(rebuilt.generatedAtMs).toBe(NOW + 9000);
    expect(rebuilt.posts).toHaveLength(1);
    expect(rebuilt.posts[0].slug).toBe("rebuild-me");
    expect(rebuilt.posts[0].draftId).toBe(draft.id);
    expect(rebuilt.posts[0].seo?.targetKeywords).toEqual(["rebuild"]);
    expect(rebuilt.posts[0].tags).toBeUndefined(); // publish-time operator data — documented degrade
    expect(await readPublishedPosts(ctx.tenantId, objectStore)).toEqual(rebuilt);
  });

  it("pins the bundle key scheme", () => {
    expect(postsBundleKey("tenant-1")).toBe("posts/tenant-1.json");
  });
});

describe("readPublishedPageHtml (the blog's verified body read)", () => {
  it("round-trips the content-addressed artifact and refuses corrupted bytes", async () => {
    const { objectStore } = await setup();
    const html = "<!doctype html><html><head><title>t</title></head><body><main>hello</main></body></html>";
    const htmlRef = `web-pages/${sha256Hex(html)}.html`;
    await objectStore.put(htmlRef, html);

    expect(await readPublishedPageHtml(htmlRef, objectStore)).toBe(html);
    expect(await readPublishedPageHtml(`web-pages/${sha256Hex("other")}.html`, objectStore)).toBeNull();

    await objectStore.put(htmlRef, "<!doctype html><html><body>tampered</body></html>");
    await expect(readPublishedPageHtml(htmlRef, objectStore)).rejects.toThrow(/content-address verification/);
  });
});
