import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { PATCH } = await import("./route");

/**
 * Control-arc parts A + A2 (s103): the arm control's write door. What it must
 * never do is as pinned as what it does — one flip per request, the rest of
 * the tenant's posting config untouched, and no path where a write to the
 * QUEUE's gate quietly becomes a write to something else.
 */

let handle: DbHandle | undefined;
let ctx: TenantCtx | undefined;

beforeEach(async () => {
  handle = await openTestDb();
  repos = handle.repos;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self", plan: "internal" });
  ctx = tenantCtx(tenant.id);
});

afterEach(async () => {
  repos = undefined;
  ctx = undefined;
  await handle?.close();
  handle = undefined;
});

function patch(body: unknown) {
  return PATCH(
    new Request("http://test.local/api/integrations/arming", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );
}

async function profileWith(social?: Record<string, unknown>) {
  if (!repos || !ctx) throw new Error("setup failed");
  return repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {}, ...(social ? { social } : {}) },
    activate: true,
  });
}

async function storedSocial() {
  if (!repos || !ctx) throw new Error("setup failed");
  return (await repos.brandProfiles.getActive(ctx))?.social as Record<string, unknown> | null;
}

describe("PATCH /api/integrations/arming", () => {
  it("flips ONE destination's arm state, leaving every other entry untouched", async () => {
    await profileWith({
      bluesky: { maxPostsPerDay: 3, armState: "off" },
      linkedin: { maxPostsPerDay: 2, armState: "review" },
    });

    expect((await patch({ platform: "bluesky", armState: "live" })).status).toBe(200);

    expect(await storedSocial()).toEqual({
      // The cap the operator set survives the flip — only the state moved.
      bluesky: { maxPostsPerDay: 3, armState: "live" },
      linkedin: { maxPostsPerDay: 2, armState: "review" },
      postingScope: "selective",
    });
  });

  it("arming an unconfigured destination CREATES its entry at the schema's default cap", async () => {
    await profileWith();
    expect((await patch({ platform: "bluesky", armState: "review" })).status).toBe(200);
    expect(await storedSocial()).toEqual({
      bluesky: { maxPostsPerDay: 1, armState: "review" },
      postingScope: "selective",
    });
  });

  it("sets the posting scope without touching a single destination's stored state", async () => {
    await profileWith({
      bluesky: { maxPostsPerDay: 1, armState: "off" },
      linkedin: { maxPostsPerDay: 2, armState: "review" },
    });

    expect((await patch({ postingScope: "all" })).status).toBe(200);

    // The overlay's whole promise: `all` is a READ mode, so flipping it
    // rewrites nobody's stored decision and flipping back is lossless.
    expect(await storedSocial()).toEqual({
      bluesky: { maxPostsPerDay: 1, armState: "off" },
      linkedin: { maxPostsPerDay: 2, armState: "review" },
      postingScope: "all",
    });
  });

  it("writes IN PLACE — an arm flip never mints a brand profile version", async () => {
    if (!repos || !ctx) throw new Error("setup failed");
    const before = await profileWith({ bluesky: { maxPostsPerDay: 1, armState: "off" } });

    await patch({ platform: "bluesky", armState: "live" });
    await patch({ postingScope: "all" });

    const after = await repos.brandProfiles.getActive(ctx);
    expect(after?.id).toBe(before.id);
    expect(after?.version).toBe(before.version);

    // The history that DOES exist is operational, on the events spine.
    const events = await repos.events.list(ctx, { entityType: "brand_profile", limit: 10 });
    const summaries = events
      .filter((e) => e.event === "brand_profile.social_updated")
      .map((e) => (e.payload as { summary: string }).summary);
    expect(summaries).toContain("bluesky → live");
    expect(summaries).toContain("posting scope → all");
  });

  it("refuses the shapes that mean nothing — one change per request", async () => {
    await profileWith();
    expect((await patch({})).status).toBe(400);
    expect((await patch({ platform: "bluesky" })).status).toBe(400);
    expect((await patch({ armState: "live" })).status).toBe(400);
    expect((await patch({ platform: "bluesky", armState: "LIVE" })).status).toBe(400);
    expect((await patch({ postingScope: "everything" })).status).toBe(400);
    // Nothing was stored by any of them.
    expect(await storedSocial()).toBeNull();
  });

  it("says so rather than silently arming nothing when there is no active profile", async () => {
    if (!repos || !ctx) throw new Error("setup failed");
    const response = await patch({ platform: "bluesky", armState: "live" });
    expect(response.status).toBe(503);
    // And it did not conjure a profile to hang the arm state on.
    expect(await repos.brandProfiles.getActive(ctx)).toBeNull();
  });
});
