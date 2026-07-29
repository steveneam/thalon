import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  pinAsset,
  publicAssetsKey,
  recordPublicAssets,
  pinnedAssetKey,
  type PublicAssetRef,
} from "@thalon/engine";
import { openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore, objectKey } from "@thalon/platform";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { GET } = await import("./route");

/**
 * B-pub.4 route family: the public image door end-to-end against the REAL
 * engine gate — the route's default object store is pointed at a temp dir
 * via THALON_DATA_DIR (the seam resolves per call), so what these tests
 * exercise is exactly the production read path: allowlist membership →
 * verified pin read → immutable-cache response.
 */

let handle: DbHandle | undefined;
let dataDir: string | undefined;
let store: LocalObjectStore | undefined;
let tenantId: string | undefined;

beforeEach(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "thalon-asset-route-"));
  process.env.THALON_DATA_DIR = dataDir;
  store = new LocalObjectStore(path.join(dataDir, "objects"));
  handle = await openTestDb();
  repos = handle.repos;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  tenantId = tenant.id;
});

afterEach(async () => {
  delete process.env.THALON_DATA_DIR;
  repos = undefined;
  store = undefined;
  tenantId = undefined;
  await handle?.close();
  handle = undefined;
  if (dataDir) {
    rmSync(dataDir, { recursive: true, force: true });
    dataDir = undefined;
  }
});

const NOW = 1_753_400_000_000;
const PNG_BYTES = Buffer.from("route-test png bytes");

async function pinPublishedPng(): Promise<PublicAssetRef> {
  const pinned = await pinAsset(store!, {
    bytes: PNG_BYTES,
    ext: "png",
    provenance: {
      vendor: "test-vendor",
      model: "test-model",
      prompt: "route test mint",
      params: {},
      creditsSpent: 0,
      licenseTier: "paid",
      mintedAt: "2026-07-25T00:00:00.000Z",
    },
  });
  const ref = { contentHash: pinned.contentHash, ext: "png" };
  await recordPublicAssets(tenantId!, { draftId: "d1", slug: "s", assets: [ref], nowMs: NOW }, store!);
  return ref;
}

function get(asset: string): Promise<Response> {
  return GET(new Request(`http://test.local/assets/${asset}`), {
    params: Promise.resolve({ asset }),
  });
}

describe("GET /assets/[asset] (the public image door)", () => {
  it("404s malformed names without touching anything: bad hash, unknown/forbidden ext, traversal shapes", async () => {
    for (const name of [
      "notahash.png",
      `${"a".repeat(64)}.svg`,
      `${"a".repeat(64)}.html`,
      `${"A".repeat(64)}.png`,
      `${"a".repeat(64)}`,
      "..%2F..%2Fsecrets.png",
    ]) {
      const res = await get(name);
      expect(res.status).toBe(404);
    }
  });

  it("404s a pinned but NEVER-published asset — the allowlist is the gate, pinning alone opens nothing", async () => {
    const pinned = await pinAsset(store!, {
      bytes: Buffer.from("secret unpublished bytes"),
      ext: "png",
      provenance: {
        vendor: "test-vendor",
        model: "test-model",
        prompt: "unpublished mint",
        params: {},
        creditsSpent: 0,
        licenseTier: "paid",
        mintedAt: "2026-07-25T00:00:00.000Z",
      },
    });
    const res = await get(`${pinned.contentHash}.png`);
    expect(res.status).toBe(404);
  });

  it("serves a published asset with verified bytes, immutable caching, and nosniff", async () => {
    const ref = await pinPublishedPng();
    const res = await get(`${ref.contentHash}.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-length")).toBe(String(PNG_BYTES.byteLength));
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PNG_BYTES);
  });

  it("503s (never a quiet 404) when a published asset's bytes are gone", async () => {
    const ref = await pinPublishedPng();
    await store!.delete(pinnedAssetKey(ref.contentHash, ref.ext));
    const res = await get(`${ref.contentHash}.png`);
    expect(res.status).toBe(503);
  });

  it("refuses tampered bytes loudly — the content-address mismatch throws through the route, nothing is served", async () => {
    const ref = await pinPublishedPng();
    await store!.put(pinnedAssetKey(ref.contentHash, ref.ext), Buffer.from("evil replacement"));
    await expect(get(`${ref.contentHash}.png`)).rejects.toThrow(/content-address verification/);
  });
});

/**
 * B-ig.1 at the door: the route's ONLY part in the publish-scoped widening is
 * supplying a real clock. These write the tenant bundle by hand — that is the
 * point, not a shortcut: they pin the STORED shape the route must honour, so
 * the two halves (the publish door writes it, this route reads it) cannot
 * drift apart silently.
 */
describe("GET /assets/[asset] — the publish-scoped pending window", () => {
  const SOCIAL_BYTES = Buffer.from("route-test social jpeg bytes");

  async function admitSocialImage(expiresAtMs: number): Promise<string> {
    const contentHash = sha256Hex(SOCIAL_BYTES);
    await store!.put(objectKey("social-media", contentHash, "jpg"), SOCIAL_BYTES);
    await store!.put(
      publicAssetsKey(tenantId!),
      JSON.stringify({
        version: 1,
        tenantId,
        generatedAtMs: Date.now(),
        posts: [],
        pending: [
          {
            draftId: "d-ig",
            platform: "instagram",
            family: "social-media",
            contentHash,
            ext: "jpg",
            expiresAtMs,
          },
        ],
      }),
    );
    return contentHash;
  }

  it("serves the image of a post being published RIGHT NOW — the route supplies the clock", async () => {
    const hash = await admitSocialImage(Date.now() + 60_000);
    const res = await get(`${hash}.jpg`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(SOCIAL_BYTES);
  });

  it("404s an EXPIRED admission — the window really is time-bounded at the door", async () => {
    const hash = await admitSocialImage(Date.now() - 1);
    expect((await get(`${hash}.jpg`)).status).toBe(404);
  });

  it("404s a social image with no admission at all — holding the bytes opens nothing", async () => {
    const contentHash = sha256Hex(SOCIAL_BYTES);
    await store!.put(objectKey("social-media", contentHash, "jpg"), SOCIAL_BYTES);
    expect((await get(`${contentHash}.jpg`)).status).toBe(404);
  });
});
