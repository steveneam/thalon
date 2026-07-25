import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { pinAsset, pinnedAssetKey } from "../../assets/pin";
import {
  extractPublicAssetRefs,
  parsePublicAssetName,
  publicAssetPath,
  publicAssetsKey,
  readPublicAssetBytes,
  readPublicAssets,
  recordPublicAssets,
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
