import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ContentAddressMismatchError,
  contentHashSegment,
  findOrphans,
  getContentAddressed,
  objectKey,
  objectPrefix,
} from "../object-keys";
import { LocalObjectStore } from "../object-store";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

let storeRoot: string | undefined;

afterEach(() => {
  if (storeRoot) {
    rmSync(storeRoot, { recursive: true, force: true });
    storeRoot = undefined;
  }
});

function newStore(): LocalObjectStore {
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-object-keys-"));
  return new LocalObjectStore(storeRoot);
}

describe("object key scheme (B4.6)", () => {
  it("builds the pinned flat and prefix conventions byte-for-byte", () => {
    const hash = sha256("x");
    expect(objectKey("web-pages", hash, "html")).toBe(`web-pages/${hash}.html`);
    expect(objectKey("demo-captures", hash, "json")).toBe(`demo-captures/${hash}.json`);
    expect(objectKey("crawl-pages", hash, "json")).toBe(`crawl-pages/${hash}.json`);
    expect(objectKey("embeddings", hash, "json")).toBe(`embeddings/${hash}.json`);
    expect(objectPrefix("renders/pillar", hash)).toBe(`renders/pillar/${hash}`);
  });

  it("rejects malformed families, ids, and extensions loudly", () => {
    expect(() => objectKey("Web Pages", "abc", "html")).toThrow(/invalid object-key family/);
    expect(() => objectKey("web-pages", "../escape", "html")).toThrow(/invalid object-key id/);
    expect(() => objectKey("web-pages", "abc", ".html")).toThrow(/invalid object-key extension/);
    expect(() => objectPrefix("renders/", "abc")).toThrow(/invalid object-key family/);
  });

  it("extracts the content-hash segment from flat and prefix-directory keys", () => {
    const hash = sha256("y");
    expect(contentHashSegment(`web-pages/${hash}.html`)).toBe(hash);
    expect(contentHashSegment(`renders/pillar/${hash}/manifest.json`)).toBe(hash);
    expect(() => contentHashSegment("embeddings/not-a-hash.json")).toThrow(
      /no sha256 content-address segment/,
    );
  });
});

describe("content-address verification on read (B4.6)", () => {
  it("returns intact bytes, null for missing, and throws on corruption", async () => {
    const store = newStore();
    const html = "<html>ok</html>";
    const key = objectKey("web-pages", sha256(html), "html");
    await store.put(key, html);
    expect((await getContentAddressed(store, key))!.toString("utf8")).toBe(html);

    expect(await getContentAddressed(store, objectKey("web-pages", sha256("absent"), "html"))).toBeNull();

    await store.put(key, "<html>tampered</html>");
    await expect(getContentAddressed(store, key)).rejects.toBeInstanceOf(ContentAddressMismatchError);
  });
});

describe("orphan detection (B4.6)", () => {
  it("flags unreferenced keys, keeps referenced keys, prefix children, and protected families", () => {
    const hash = sha256("z");
    const allKeys = [
      `web-pages/${hash}.html`,
      "web-pages/deadbeef.html",
      `renders/pillar/${hash}/manifest.json`,
      `renders/pillar/${hash}/captions.srt`,
      "renders/pillar/0000/manifest.json",
      "embeddings/cachekey.json",
    ];
    const referenced = [`web-pages/${hash}.html`, `renders/pillar/${hash}`];
    const orphans = findOrphans(allKeys, referenced, { protectedPrefixes: ["embeddings/"] });
    expect(orphans).toEqual(["web-pages/deadbeef.html", "renders/pillar/0000/manifest.json"]);
  });
});
