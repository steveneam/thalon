import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Draft, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { postsBundleKey } from "../../webpage/posts";
import { readPublishedView, socialPermalink } from "../published";

/**
 * B-int.2 pins: the published view — the two ledgers merged newest-first,
 * bounded with honest totals, every item carrying its way back (Source-Link
 * Rule), and the excerpt a recognition aid, never the record.
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

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos; objectStore: LocalObjectStore }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-published-"));
  return { ctx: tenantCtx(tenant.id), repos, objectStore: new LocalObjectStore(storeRoot) };
}

let seq = 0;

async function socialDraft(ctx: TenantCtx, repos: Repos, body: string): Promise<Draft> {
  const n = ++seq;
  const profile =
    (await repos.brandProfiles.getActive(ctx)) ??
    (await repos.brandProfiles.create(ctx, {
      config: { voice: {}, denylist: [], platformProfiles: {} },
      activate: true,
    }));
  const source = await repos.sources.create(ctx, {
    kind: "prompt",
    contentHash: sha256Hex(`brief-${n}`),
  });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["linkedin"],
    promptVersion: "fanout.v1",
    model: "test/model",
    generationKey: sha256Hex(`${ctx.tenantId}:run-${n}`),
  });
  return repos.drafts.create(ctx, {
    fanoutRunId: run.id,
    sourceId: source.id,
    platform: "linkedin",
    body,
    generationKey: sha256Hex(`${ctx.tenantId}:draft-${n}`),
  });
}

describe("socialPermalink (the way back)", () => {
  it("a driver-recorded permalink wins; platform URL shapes derive the rest; unknown stays null", () => {
    expect(socialPermalink("facebook", "197_122", { permalink: "https://fb.example/x" })).toBe(
      "https://fb.example/x",
    );
    expect(socialPermalink("facebook", "197_122", {})).toBe("https://www.facebook.com/197_122");
    expect(socialPermalink("linkedin", "urn:li:share:9", {})).toBe(
      "https://www.linkedin.com/feed/update/urn:li:share:9",
    );
    expect(socialPermalink("x", "123", {})).toBe("https://x.com/i/web/status/123");
    // s83: the at:// record URI maps to the public web URL; anything else
    // gets no invented link (the first live bluesky post proved this gap).
    expect(
      socialPermalink("bluesky", "at://did:plc:abc/app.bsky.feed.post/3k44", {}),
    ).toBe("https://bsky.app/profile/did:plc:abc/post/3k44");
    expect(socialPermalink("bluesky", "abc", {})).toBeNull();
    expect(socialPermalink("reddit", "t3_abc", {})).toBeNull();
    expect(socialPermalink("reddit", "t3_abc", { permalink: "https://reddit.example/p" })).toBe(
      "https://reddit.example/p",
    );
  });
});

describe("readPublishedView", () => {
  it("is honestly empty before anything ever published", async () => {
    const { ctx, repos, objectStore } = await setup();
    const view = await readPublishedView(ctx, repos, { objectStore });
    expect(view.items).toEqual([]);
    expect(view.socialTotal).toBe(0);
    expect(view.webTotal).toBe(0);
  });

  it("merges the social ledger and the web bundle newest-first, bounded, with honest totals", async () => {
    const { ctx, repos, objectStore } = await setup();
    const draft = await socialDraft(ctx, repos, "We shipped a thing today.\n\nAnd it is long.");
    await repos.socialPublications.record(ctx, {
      draftId: draft.id,
      platform: "linkedin",
      externalPostId: "urn:li:share:9",
      bodyHash: sha256Hex(draft.body),
      publishedAt: new Date("2026-07-25T09:00:00Z"),
      meta: { permalink: "https://www.linkedin.com/feed/update/urn:li:share:9" },
    });
    await repos.socialPublications.record(ctx, {
      draftId: draft.id,
      platform: "facebook",
      externalPostId: "197_122",
      bodyHash: sha256Hex(draft.body),
      publishedAt: new Date("2026-07-25T09:05:00Z"),
      meta: { pageId: "197", photoId: "122" }, // the photo leg records no permalink
    });
    await objectStore.put(
      postsBundleKey(ctx.tenantId),
      JSON.stringify({
        version: 1,
        tenantId: ctx.tenantId,
        generatedAtMs: 1_753_000_000_000,
        posts: [
          {
            slug: "the-honest-engine",
            title: "The honest engine",
            description: "d",
            draftId: draft.id,
            htmlRef: "web-pages/abc.html",
            publishedAtMs: new Date("2026-07-25T09:02:00Z").getTime(),
          },
        ],
      }),
    );

    const view = await readPublishedView(ctx, repos, { objectStore });

    expect(view.items.map((i) => i.kind)).toEqual(["social", "web", "social"]);
    expect(view.socialTotal).toBe(2);
    expect(view.webTotal).toBe(1);

    const [facebook, web, linkedin] = view.items;
    // The way back exists on every item — derived where the driver recorded none.
    expect(facebook.kind === "social" && facebook.permalink).toBe(
      "https://www.facebook.com/197_122",
    );
    expect(linkedin.kind === "social" && linkedin.permalink).toBe(
      "https://www.linkedin.com/feed/update/urn:li:share:9",
    );
    expect(web.kind === "web" && web.path).toBe("/blog/the-honest-engine");
    // The excerpt is one flattened, bounded line of the judged body.
    expect(facebook.kind === "social" && facebook.excerpt).toBe(
      "We shipped a thing today. And it is long.",
    );

    const bounded = await readPublishedView(ctx, repos, { objectStore, limit: 1 });
    expect(bounded.items).toHaveLength(1);
    expect(bounded.socialTotal).toBe(2);
    expect(bounded.webTotal).toBe(1);
  });
});
