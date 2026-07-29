import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { LocalObjectStore, objectKey } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { pinAsset, pinnedAssetKey } from "../../assets/pin";
import {
  admitPendingPublicAsset,
  extractPublicAssetRefs,
  parsePendingPublicAssetRef,
  parsePublicAssetName,
  PENDING_PUBLIC_ASSET_TTL_MS,
  publicAssetPath,
  publicAssetsBundleSchema,
  publicAssetsKey,
  readPublicAssetBytes,
  readPublicAssets,
  rebuildPublicAssets,
  recordPublicAssets,
  revokePendingPublicAsset,
  type PublicAssetRef,
} from "../public-assets";

/**
 * B-pub.4 gate tests: the allowlist IS the security property — a pinned but
 * never-published asset must be unreachable, the name grammar must refuse
 * everything that isn't exactly `<sha256>.<served ext>`, reads stay
 * content-address-verified, and the wire shapes (pointer key + public URL)
 * are pinned bytes.
 */

let storeRoot: string | undefined;

afterEach(() => {
  if (storeRoot) {
    rmSync(storeRoot, { recursive: true, force: true });
    storeRoot = undefined;
  }
});

function newStore(): LocalObjectStore {
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-public-assets-"));
  return new LocalObjectStore(storeRoot);
}

const TENANT = "tenant-1";
const NOW = 1_753_400_000_000;

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function pinPng(store: LocalObjectStore, seed: string): Promise<PublicAssetRef> {
  const bytes = Buffer.from(`png-bytes-${seed}`);
  const pinned = await pinAsset(store, {
    bytes,
    ext: "png",
    provenance: {
      vendor: "test-vendor",
      model: "test-model",
      prompt: `mint ${seed}`,
      params: {},
      creditsSpent: 0,
      licenseTier: "paid",
      mintedAt: "2026-07-25T00:00:00.000Z",
    },
  });
  return { contentHash: pinned.contentHash, ext: "png" };
}

describe("wire-shape pins (the IG/Threads contract)", () => {
  it("pins the pointer key and the public URL path", () => {
    expect(publicAssetsKey(TENANT)).toBe("public-assets/tenant-1.json");
    const hash = "a".repeat(64);
    expect(publicAssetPath({ contentHash: hash, ext: "png" })).toBe(`/assets/${hash}.png`);
    expect(pinnedAssetKey(hash, "png")).toBe(`assets/${hash}/asset.png`);
  });
});

describe("parsePublicAssetName (the serve-side grammar — strict, fail-closed)", () => {
  const HASH = "0123456789abcdef".repeat(4);

  it("accepts exactly <64 lowercase hex>.<served ext>", () => {
    expect(parsePublicAssetName(`${HASH}.png`)).toEqual({ contentHash: HASH, ext: "png" });
    expect(parsePublicAssetName(`${HASH}.jpeg`)).toEqual({ contentHash: HASH, ext: "jpeg" });
  });

  it.each([
    [`${HASH}.svg`, "svg is script-capable — never served"],
    [`${HASH}.html`, "documents never served"],
    [`${HASH}`, "no extension"],
    [`${HASH.slice(0, 63)}.png`, "short hash"],
    [`${HASH.toUpperCase()}.png`, "uppercase hash"],
    [`../${HASH}.png`, "traversal"],
    [`${HASH}.png.bak`, "suffixed"],
    [`x${HASH}.png`, "prefixed"],
    ["provenance.json", "sibling manifest name"],
  ])("refuses %s (%s)", (name) => {
    expect(parsePublicAssetName(name)).toBeNull();
  });
});

describe("extractPublicAssetRefs (the publish-side admission scan)", () => {
  it("finds refs across carriers, dedupes, sorts, and drops unservable extensions", () => {
    const a = "a".repeat(64);
    const b = "b".repeat(64);
    const c = "c".repeat(64);
    const html = `<html><head><style>.hero{background:url(/assets/${b}.webp)}</style></head><body>
      <img src="/assets/${a}.png" alt="one" />
      <img srcset="/assets/${a}.png 1x, /assets/${c}.jpg 2x" alt="two" />
      <img src="/assets/${c}.svg" alt="never served" />
      <p>plain text repeat: /assets/${a}.png</p>
    </body></html>`;
    expect(extractPublicAssetRefs(html)).toEqual([
      { contentHash: a, ext: "png" },
      { contentHash: b, ext: "webp" },
      { contentHash: c, ext: "jpg" },
    ]);
    expect(extractPublicAssetRefs("<html><body>no refs</body></html>")).toEqual([]);
  });
});

describe("record + read (the allowlist round-trip)", () => {
  it("reads null before the first record; upserts per draft; revokes when a republish drops the asset; drops empty rows", async () => {
    const store = newStore();
    expect(await readPublicAssets(TENANT, store)).toBeNull();

    const one = { contentHash: "1".repeat(64), ext: "png" };
    const two = { contentHash: "2".repeat(64), ext: "jpg" };
    await recordPublicAssets(TENANT, { draftId: "d1", slug: "post-one", assets: [one], nowMs: NOW }, store);
    await recordPublicAssets(TENANT, { draftId: "d2", slug: "another", assets: [one, two], nowMs: NOW + 1 }, store);

    const bundle = await readPublicAssets(TENANT, store);
    expect(bundle?.version).toBe(1);
    expect(bundle?.generatedAtMs).toBe(NOW + 1);
    // Deterministic order: rows sort by slug.
    expect(bundle?.posts.map((row) => row.slug)).toEqual(["another", "post-one"]);

    // Republish of d2 without `two`: revoked; `one` survives via d1's row.
    await recordPublicAssets(TENANT, { draftId: "d2", slug: "another", assets: [one], nowMs: NOW + 2 }, store);
    const afterRevoke = await readPublicAssets(TENANT, store);
    expect(afterRevoke?.posts.flatMap((row) => row.assets)).toEqual([one, one]);

    // Republish of d1 with no assets at all: its row disappears.
    await recordPublicAssets(TENANT, { draftId: "d1", slug: "post-one", assets: [], nowMs: NOW + 3 }, store);
    expect((await readPublicAssets(TENANT, store))?.posts.map((row) => row.draftId)).toEqual(["d2"]);
  });
});

describe("readPublicAssetBytes (THE gate)", () => {
  it("refuses a pinned but never-published asset — pinning alone must not open the door", async () => {
    const store = newStore();
    const ref = await pinPng(store, "unpublished");
    expect(await readPublicAssetBytes(TENANT, ref, store)).toEqual({ status: "not_public" });
  });

  it("serves an allowlisted asset with verified bytes and the right content type", async () => {
    const store = newStore();
    const ref = await pinPng(store, "published");
    await recordPublicAssets(TENANT, { draftId: "d1", slug: "s", assets: [ref], nowMs: NOW }, store);

    const result = await readPublicAssetBytes(TENANT, ref, store);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");
    expect(result.contentType).toBe("image/png");
    expect(sha256(result.bytes)).toBe(ref.contentHash);
  });

  it("reports `missing` (not a quiet 404) when an allowlisted asset's bytes are gone", async () => {
    const store = newStore();
    const ref = await pinPng(store, "vanishing");
    await recordPublicAssets(TENANT, { draftId: "d1", slug: "s", assets: [ref], nowMs: NOW }, store);
    await store.delete(pinnedAssetKey(ref.contentHash, ref.ext));
    expect(await readPublicAssetBytes(TENANT, ref, store)).toEqual({ status: "missing" });
  });

  it("refuses tampered bytes loudly (B4.6 verified read), never serving them", async () => {
    const store = newStore();
    const ref = await pinPng(store, "tampered");
    await recordPublicAssets(TENANT, { draftId: "d1", slug: "s", assets: [ref], nowMs: NOW }, store);
    await store.put(pinnedAssetKey(ref.contentHash, ref.ext), Buffer.from("evil bytes"));
    await expect(readPublicAssetBytes(TENANT, ref, store)).rejects.toThrow(
      /content-address verification/,
    );
  });

  it("never serves an unlisted ref even when another asset IS public (no cross-admission)", async () => {
    const store = newStore();
    const published = await pinPng(store, "public-one");
    const secret = await pinPng(store, "secret-one");
    await recordPublicAssets(TENANT, { draftId: "d1", slug: "s", assets: [published], nowMs: NOW }, store);
    expect(await readPublicAssetBytes(TENANT, secret, store)).toEqual({ status: "not_public" });
  });
});

/**
 * B-ig.1 (s86): the publish-scoped PENDING admission. Each `it` below pins
 * one clause of the bound the gate now carries — "…plus, for at most five
 * minutes, the one image of a post being published right now, for a driver
 * that declared it publishes by address." Delete any of them and the gate
 * silently gets wider than that sentence.
 */

/** A draft's media ref as the publish door holds it: `social-media/<sha256>.<ext>`, NOT pinned. */
async function putSocialMedia(
  store: LocalObjectStore,
  seed: string,
  ext = "jpg",
): Promise<{ ref: PublicAssetRef; bytes: Buffer }> {
  const bytes = Buffer.from(`jpeg-bytes-${seed}`);
  const contentHash = sha256(bytes);
  await store.put(objectKey("social-media", contentHash, ext), bytes);
  return { ref: { contentHash, ext }, bytes };
}

function admit(
  store: LocalObjectStore,
  ref: PublicAssetRef,
  opts: { draftId?: string; platform?: string; nowMs?: number; ttlMs?: number } = {},
) {
  return admitPendingPublicAsset(
    TENANT,
    {
      draftId: opts.draftId ?? "d-ig",
      platform: opts.platform ?? "instagram",
      family: "social-media",
      ref,
      nowMs: opts.nowMs ?? NOW,
      ...(opts.ttlMs === undefined ? {} : { ttlMs: opts.ttlMs }),
    },
    store,
  );
}

describe("parsePendingPublicAssetRef (the door-side grammar — a CLOSED family set)", () => {
  const HASH = "0123456789abcdef".repeat(4);

  it("accepts a social-media ref whose extension the door can actually serve", () => {
    expect(parsePendingPublicAssetRef(`social-media/${HASH}.jpg`)).toEqual({
      family: "social-media",
      ref: { contentHash: HASH, ext: "jpg" },
    });
  });

  it.each([
    [`assets/${HASH}.png`, "the pin family — pending is not a second way into it"],
    [`web-pages/${HASH}.html`, "another family entirely"],
    [`social-media-evil/${HASH}.jpg`, "family is an enum, not a prefix match"],
    [`social-media/${HASH}.svg`, "an extension the door refuses to serve"],
    [`social-media/${HASH}/asset.jpg`, "prefix-directory shape"],
    [`social-media/${HASH.toUpperCase()}.jpg`, "uppercase hash"],
    [`social-media/${HASH.slice(0, 63)}.jpg`, "short hash"],
    [`../social-media/${HASH}.jpg`, "traversal"],
    [`social-media/${HASH}.jpg?x=1`, "query smuggling"],
    ["", "empty"],
  ])("refuses %s (%s)", (ref) => {
    expect(parsePendingPublicAssetRef(ref)).toBeNull();
  });
});

describe("the pending admission (B-ig.1: publish-scoped, TTL-bounded, revocable)", () => {
  it("opens ONE image for five minutes and serves it — only to a reader that supplied a clock", async () => {
    const store = newStore();
    const { ref, bytes } = await putSocialMedia(store, "admitted");

    // Before admission: nothing, clock or no clock.
    expect(await readPublicAssetBytes(TENANT, ref, store, { nowMs: NOW })).toEqual({
      status: "not_public",
    });

    const bundle = await admit(store, ref);
    expect(bundle.pending).toEqual([
      {
        draftId: "d-ig",
        platform: "instagram",
        family: "social-media",
        contentHash: ref.contentHash,
        ext: "jpg",
        expiresAtMs: NOW + PENDING_PUBLIC_ASSET_TTL_MS,
      },
    ]);
    // The published allowlist is untouched — admission is not a publish.
    expect(bundle.posts).toEqual([]);

    const served = await readPublicAssetBytes(TENANT, ref, store, { nowMs: NOW });
    expect(served.status).toBe("ok");
    if (served.status !== "ok") throw new Error("unreachable");
    expect(served.bytes).toEqual(bytes);
    expect(served.contentType).toBe("image/jpeg");
  });

  it("NO CLOCK → pending rows are ignored entirely: every pre-B-ig.1 caller stays byte-identical", async () => {
    const store = newStore();
    const { ref } = await putSocialMedia(store, "no-clock");
    await admit(store, ref);
    // The old 3-arg call — the one the route made before this lane.
    expect(await readPublicAssetBytes(TENANT, ref, store)).toEqual({ status: "not_public" });
    expect(await readPublicAssetBytes(TENANT, ref, store, {})).toEqual({ status: "not_public" });
  });

  it("expires ON ITS OWN: served at the last millisecond, refused at expiry and after", async () => {
    const store = newStore();
    const { ref } = await putSocialMedia(store, "expiring");
    await admit(store, ref);
    const expiresAtMs = NOW + PENDING_PUBLIC_ASSET_TTL_MS;

    expect((await readPublicAssetBytes(TENANT, ref, store, { nowMs: expiresAtMs - 1 })).status).toBe(
      "ok",
    );
    expect(await readPublicAssetBytes(TENANT, ref, store, { nowMs: expiresAtMs })).toEqual({
      status: "not_public",
    });
    expect(await readPublicAssetBytes(TENANT, ref, store, { nowMs: expiresAtMs + 60_000 })).toEqual({
      status: "not_public",
    });
  });

  it("revocation closes it immediately — the normal path, not the backstop", async () => {
    const store = newStore();
    const { ref } = await putSocialMedia(store, "revoked");
    await admit(store, ref);
    expect((await readPublicAssetBytes(TENANT, ref, store, { nowMs: NOW })).status).toBe("ok");

    const after = await revokePendingPublicAsset(
      TENANT,
      { draftId: "d-ig", platform: "instagram", ref, nowMs: NOW + 10 },
      store,
    );
    expect(after?.pending).toEqual([]);
    expect(await readPublicAssetBytes(TENANT, ref, store, { nowMs: NOW + 10 })).toEqual({
      status: "not_public",
    });
  });

  it("revoking without a bundle, or twice, is a quiet no-op (a revoke must never throw at the door)", async () => {
    const store = newStore();
    const { ref } = await putSocialMedia(store, "double-revoke");
    const scope = { draftId: "d-ig", platform: "instagram", ref, nowMs: NOW };
    expect(await revokePendingPublicAsset(TENANT, scope, store)).toBeNull();
    await admit(store, ref);
    await revokePendingPublicAsset(TENANT, scope, store);
    expect((await revokePendingPublicAsset(TENANT, scope, store))?.pending).toEqual([]);
  });

  it("is scoped to ONE image: a second, un-admitted social image stays private", async () => {
    const store = newStore();
    const { ref: admitted } = await putSocialMedia(store, "the-one");
    const { ref: other } = await putSocialMedia(store, "not-the-one");
    await admit(store, admitted);
    expect(await readPublicAssetBytes(TENANT, other, store, { nowMs: NOW })).toEqual({
      status: "not_public",
    });
  });

  it("stores NO object key — the source key is RECONSTRUCTED from the row's own hash", async () => {
    // THE POINT, and the reason this test exists: a row that carried its own
    // source key could pair `contentHash: B` with a key naming hash `A`, and
    // the door would then serve A's bytes under B's URL — breaking the
    // `immutable` cache promise on a content-addressed door. Deriving the key
    // from the row's OWN hash makes that unrepresentable. If a future
    // refactor "simplifies" this by storing the key, this test fails loudly,
    // which is exactly what it is for.
    const store = newStore();
    const { ref: a, bytes: bytesOfA } = await putSocialMedia(store, "hash-a");
    const b: PublicAssetRef = { contentHash: "b".repeat(64), ext: "jpg" };

    const bundle = await admit(store, b);
    // A key would have to carry a "/" — no row field may contain one.
    expect(JSON.stringify(bundle.pending)).not.toContain("/");

    // B's URL serves nothing at all, and above all not A's bytes.
    const served = await readPublicAssetBytes(TENANT, b, store, { nowMs: NOW });
    expect(served).toEqual({ status: "missing" });
    expect(JSON.stringify(served)).not.toContain(bytesOfA.toString("utf8"));
    // …and admitting B never admitted A.
    expect(await readPublicAssetBytes(TENANT, a, store, { nowMs: NOW })).toEqual({
      status: "not_public",
    });
  });

  it("re-hashes on read: tampered source bytes refuse loudly, never served", async () => {
    const store = newStore();
    const { ref } = await putSocialMedia(store, "tamper-pending");
    await admit(store, ref);
    await store.put(objectKey("social-media", ref.contentHash, "jpg"), Buffer.from("evil bytes"));
    await expect(readPublicAssetBytes(TENANT, ref, store, { nowMs: NOW })).rejects.toThrow(
      /content-address verification/,
    );
  });

  it("re-admitting the same image replaces its row and extends it — never duplicates", async () => {
    const store = newStore();
    const { ref } = await putSocialMedia(store, "retry");
    await admit(store, ref);
    const again = await admit(store, ref, { nowMs: NOW + 1_000 });
    expect(again.pending).toHaveLength(1);
    expect(again.pending[0].expiresAtMs).toBe(NOW + 1_000 + PENDING_PUBLIC_ASSET_TTL_MS);
  });

  it("self-heals: every admission write prunes rows that already expired", async () => {
    const store = newStore();
    const { ref: stale } = await putSocialMedia(store, "stale");
    const { ref: fresh } = await putSocialMedia(store, "fresh");
    await admit(store, stale, { draftId: "d-old", ttlMs: 1_000 });

    const later = NOW + 60_000;
    const bundle = await admit(store, fresh, { draftId: "d-new", nowMs: later });
    expect(bundle.pending.map((row) => row.contentHash)).toEqual([fresh.contentHash]);
  });

  it("a web-page publish carries live admissions forward (and drops dead ones)", async () => {
    const store = newStore();
    const { ref: live } = await putSocialMedia(store, "survives-a-publish");
    const { ref: dead } = await putSocialMedia(store, "already-expired");
    await admit(store, live, { draftId: "d-live" });
    await admit(store, dead, { draftId: "d-dead", ttlMs: 1 });

    const pinned = await pinPng(store, "blog-image");
    await recordPublicAssets(
      TENANT,
      { draftId: "web-1", slug: "a-post", assets: [pinned], nowMs: NOW + 100 },
      store,
    );

    // The mid-flight social publish is NOT broken by an unrelated web publish…
    expect((await readPublicAssetBytes(TENANT, live, store, { nowMs: NOW + 100 })).status).toBe("ok");
    // …and the expired row is gone from the bundle for good.
    expect((await readPublicAssets(TENANT, store))?.pending.map((row) => row.draftId)).toEqual([
      "d-live",
    ]);
  });

  it("rebuildPublicAssets DROPS pending — disaster recovery breaks a racing publish loudly", async () => {
    const store = newStore();
    const { ref } = await putSocialMedia(store, "rebuilt-away");
    await admit(store, ref);
    await rebuildPublicAssets(TENANT, [], NOW + 5, store);
    expect((await readPublicAssets(TENANT, store))?.pending).toEqual([]);
    expect(await readPublicAssetBytes(TENANT, ref, store, { nowMs: NOW + 5 })).toEqual({
      status: "not_public",
    });
  });

  it("a PUBLISHED row still wins, and still needs no clock (the B-pub.4 path is untouched)", async () => {
    const store = newStore();
    const pinned = await pinPng(store, "published-and-admitted");
    await recordPublicAssets(TENANT, { draftId: "d1", slug: "s", assets: [pinned], nowMs: NOW }, store);
    await admit(store, pinned, { draftId: "d-ig" });
    // Served from the PIN store with no clock at all — the pending row is not
    // consulted, so a published asset can never be "unpublished" by expiry.
    expect((await readPublicAssetBytes(TENANT, pinned, store)).status).toBe("ok");
  });

  it("parses a pre-B-ig.1 bundle unchanged: no version bump, no migration", async () => {
    const store = newStore();
    const legacy = {
      version: 1,
      tenantId: TENANT,
      generatedAtMs: NOW,
      posts: [{ draftId: "d1", slug: "s", assets: [{ contentHash: "1".repeat(64), ext: "png" }] }],
    };
    await store.put(publicAssetsKey(TENANT), JSON.stringify(legacy));
    const bundle = await readPublicAssets(TENANT, store);
    expect(bundle?.version).toBe(1);
    expect(bundle?.pending).toEqual([]);
    expect(publicAssetsBundleSchema.parse(legacy).pending).toEqual([]);
  });
});
