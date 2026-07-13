import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ContentAddressMismatchError, LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import {
  FreeTierAssetError,
  pinAsset,
  readAssetProvenance,
  readPinnedAsset,
  type AssetProvenance,
} from "../pin";

const provenance = (overrides: Partial<AssetProvenance> = {}): AssetProvenance => ({
  vendor: "vendor-a",
  model: "image-model-1",
  prompt: "a lighthouse at dusk, warm sails palette",
  params: { aspect: "16:9" },
  creditsSpent: 6,
  licenseTier: "paid",
  mintedAt: "2026-07-13T12:00:00.000Z",
  sourceUrl: "https://cdn.example.com/mints/abc.png",
  jobId: "job-abc",
  ...overrides,
});

describe("B7.1 asset pinning", () => {
  const roots: string[] = [];
  const newStore = () => {
    const root = mkdtempSync(path.join(tmpdir(), "thalon-assets-"));
    roots.push(root);
    return new LocalObjectStore(root);
  };
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("pins bytes under the content-addressed prefix with a sibling manifest — byte-stable key pin", async () => {
    const store = newStore();
    const pinned = await pinAsset(store, {
      bytes: Buffer.from("asset-bytes-v1"),
      ext: "png",
      provenance: provenance(),
    });
    // Literal vector (A10 discipline): sha256("asset-bytes-v1"). If this
    // breaks, every already-pinned asset key breaks with it.
    expect(pinned.key).toBe(
      "assets/52d75e7b3e2790a1a08bd10fb122cc016594f7586a807d66ab1d9921973b713b/asset.png",
    );
    expect(pinned.provenanceKey).toBe(
      "assets/52d75e7b3e2790a1a08bd10fb122cc016594f7586a807d66ab1d9921973b713b/provenance.json",
    );
    expect(pinned.alreadyPinned).toBe(false);
    expect(pinned.bytes).toBe(14);

    const roundTrip = await readPinnedAsset(store, pinned.key);
    expect(roundTrip?.toString("utf8")).toBe("asset-bytes-v1");

    const manifest = await readAssetProvenance(store, pinned.contentHash);
    expect(manifest?.asset).toEqual({ contentHash: pinned.contentHash, ext: "png", bytes: 14 });
    expect(manifest?.provenance.prompt).toBe("a lighthouse at dusk, warm sails palette");
    // The manifest resolves from either stored key too.
    expect(await readAssetProvenance(store, pinned.key)).toEqual(manifest);
  });

  it("downloads via the injected fetch when given a url, and fails loud on non-2xx", async () => {
    const store = newStore();
    const calls: string[] = [];
    const fetchImpl = (async (url: unknown) => {
      calls.push(String(url));
      return new Response(Buffer.from("downloaded-bytes"), { status: 200 });
    }) as typeof fetch;

    const pinned = await pinAsset(
      store,
      { url: "https://cdn.example.com/mints/abc.png", ext: "png", provenance: provenance() },
      { fetchImpl },
    );
    expect(calls).toEqual(["https://cdn.example.com/mints/abc.png"]);
    expect((await readPinnedAsset(store, pinned.key))?.toString("utf8")).toBe("downloaded-bytes");

    const failing = (async () => new Response("gone", { status: 404, statusText: "Not Found" })) as unknown as typeof fetch;
    await expect(
      pinAsset(
        store,
        { url: "https://cdn.example.com/mints/expired.png", ext: "png", provenance: provenance() },
        { fetchImpl: failing },
      ),
    ).rejects.toThrow(/asset download failed: 404/);
  });

  it("re-pin of identical bytes is a no-op that keeps the FIRST manifest", async () => {
    const store = newStore();
    const first = await pinAsset(store, {
      bytes: Buffer.from("same-bytes"),
      ext: "png",
      provenance: provenance({ mintedAt: "2026-07-13T12:00:00.000Z" }),
    });
    const second = await pinAsset(store, {
      bytes: Buffer.from("same-bytes"),
      ext: "png",
      provenance: provenance({ mintedAt: "2026-07-14T09:00:00.000Z", creditsSpent: 99 }),
    });
    expect(second.alreadyPinned).toBe(true);
    expect(second.key).toBe(first.key);
    const manifest = await readAssetProvenance(store, first.contentHash);
    expect(manifest?.provenance.mintedAt).toBe("2026-07-13T12:00:00.000Z");
    expect(manifest?.provenance.creditsSpent).toBe(6);
  });

  it("refuses free-tier mints unless explicitly allowed (A15 invariant at the door)", async () => {
    const store = newStore();
    const input = {
      bytes: Buffer.from("watermarked"),
      ext: "png",
      provenance: provenance({ licenseTier: "free" as const }),
    };
    await expect(pinAsset(store, input)).rejects.toThrow(FreeTierAssetError);

    const pinned = await pinAsset(store, input, { allowFreeTier: true });
    const manifest = await readAssetProvenance(store, pinned.contentHash);
    expect(manifest?.provenance.licenseTier).toBe("free");
  });

  it("rejects invalid inputs loudly: bad provenance, bad ext, both/neither byte sources, empty bodies", async () => {
    const store = newStore();
    const base = { bytes: Buffer.from("x"), ext: "png" };
    await expect(
      pinAsset(store, { ...base, provenance: provenance({ prompt: "" }) }),
    ).rejects.toThrow(); // zod: prompt required
    await expect(
      pinAsset(store, { ...base, ext: "PNG!", provenance: provenance() }),
    ).rejects.toThrow(/invalid asset extension/);
    await expect(
      pinAsset(store, {
        bytes: Buffer.from("x"),
        url: "https://cdn.example.com/a.png",
        ext: "png",
        provenance: provenance(),
      }),
    ).rejects.toThrow(/exactly one of bytes \/ url/);
    await expect(
      pinAsset(store, { ext: "png", provenance: provenance() }),
    ).rejects.toThrow(/exactly one of bytes \/ url/);
    await expect(
      pinAsset(store, { bytes: Buffer.alloc(0), ext: "png", provenance: provenance() }),
    ).rejects.toThrow(/empty asset body/);
  });

  it("read side verifies the content address — corrupted bytes never get served", async () => {
    const store = newStore();
    const pinned = await pinAsset(store, {
      bytes: Buffer.from("pristine"),
      ext: "png",
      provenance: provenance(),
    });
    await store.put(pinned.key, Buffer.from("tampered"));
    await expect(readPinnedAsset(store, pinned.key)).rejects.toThrow(ContentAddressMismatchError);
    expect(await readPinnedAsset(store, "assets/" + "0".repeat(64) + "/asset.png")).toBeNull();
  });
});
