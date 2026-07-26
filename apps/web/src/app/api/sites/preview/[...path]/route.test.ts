import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PreviewUpstream } from "@/lib/sites/provider";

let upstream: PreviewUpstream = { kind: "unconfigured" };
vi.mock("@/lib/sites/provider", () => ({
  resolvePreviewUpstream: () => upstream,
}));

const { GET } = await import("./route");

/**
 * The preview door, end to end against a real template tree.
 *
 * What it is FOR: a viewer who is not on the box. The old surfaces stamped
 * `http://127.0.0.1:8899` into every `<img>` and the dossier iframe, so from
 * the founder's laptop every thumbnail resolved against HIS loopback and the
 * whole preview was broken (s75). These pin the replacement's contract: the
 * workspace serves the bytes itself, and it does so fail-closed.
 */

let dir: string | undefined;

function get(pathname: string, headers?: Record<string, string>): Promise<Response> {
  const segments = pathname.split("/").filter(Boolean);
  return GET(new Request(`http://workspace.test/api/sites/preview/${pathname}`, { headers }), {
    params: Promise.resolve({ path: segments }),
  });
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "thalon-sites-preview-"));
  mkdirSync(path.join(dir, "sparkwright", "assets"), { recursive: true });
  mkdirSync(path.join(dir, "sparkwright", "guide"), { recursive: true });
  writeFileSync(path.join(dir, "sparkwright", "index.html"), "<h1>Sparkwright</h1>");
  writeFileSync(path.join(dir, "sparkwright", "guide", "index.html"), "<h1>How it was made</h1>");
  writeFileSync(path.join(dir, "sparkwright", "assets", "hero.webp"), Buffer.from([1, 2, 3, 4]));
  writeFileSync(path.join(dir, "sparkwright", "secrets.pem"), "PRIVATE KEY");
  writeFileSync(path.join(path.dirname(dir), "outside.webp"), "not the portfolio");
  upstream = { kind: "dir", dir };
});

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
  vi.unstubAllGlobals();
});

describe("the site-preview door — reading the local template directory", () => {
  it("serves a site's own media with its true type", async () => {
    const res = await get("sparkwright/assets/hero.webp");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("serves the page itself, so the dossier iframe has something to frame", async () => {
    const res = await get("sparkwright/index.html");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await res.text()).toContain("Sparkwright");
  });

  it("never heuristically caches, and revalidates cheaply with an ETag", async () => {
    const first = await get("sparkwright/assets/hero.webp");
    const etag = first.headers.get("etag");

    expect(first.headers.get("cache-control")).toBe("no-cache, must-revalidate");
    expect(etag).toBeTruthy();

    const second = await get("sparkwright/assets/hero.webp", { "if-none-match": etag! });
    expect(second.status).toBe(304);
    expect(second.headers.get("etag")).toBe(etag);
  });

  it("redirects a page asked for as a directory to its document URL", async () => {
    // The page's own `../fonts/…` and `assets/…` only resolve when the
    // document URL carries the directory it lives in, and Next strips the
    // trailing slash before this handler ever runs.
    const res = await get("sparkwright/guide");

    expect(res.status).toBe(308);
    expect(new URL(res.headers.get("location")!).pathname).toBe(
      "/api/sites/preview/sparkwright/guide/index.html",
    );
  });
});

describe("the site-preview door — fail-closed", () => {
  it("refuses to walk out of the portfolio", async () => {
    const res = await GET(new Request("http://workspace.test/api/sites/preview/x"), {
      params: Promise.resolve({ path: ["..", "outside.webp"] }),
    });

    expect(res.status).toBe(404);
  });

  it("refuses a file kind the portfolio does not ship, even when it is right there", async () => {
    const res = await get("sparkwright/secrets.pem");

    expect(res.status).toBe(404);
  });

  it("404s a path that simply is not there", async () => {
    expect((await get("sparkwright/assets/missing.webp")).status).toBe(404);
  });

  it("says a missing origin out loud instead of 404ing like empty media", async () => {
    upstream = { kind: "unconfigured" };
    const res = await get("sparkwright/assets/hero.webp");

    expect(res.status).toBe(503);
    expect(await res.text()).toMatch(/no sites origin is configured/);
  });
});

describe("the site-preview door — proxying a configured origin", () => {
  it("fetches the upstream path and stamps OUR content type, not the upstream's claim", async () => {
    upstream = { kind: "origin", origin: "https://sites.example" };
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([9, 9]), {
          headers: { "content-type": "application/octet-stream", "cache-control": "max-age=60" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await get("sparkwright/assets/hero.webp");

    expect(fetchMock).toHaveBeenCalledWith("https://sites.example/sparkwright/assets/hero.webp", {
      cache: "no-store",
      redirect: "follow",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toBe("max-age=60");
  });

  it("passes the origin's 404 through, and turns any other refusal into a named 502", async () => {
    upstream = { kind: "origin", origin: "https://sites.example" };

    vi.stubGlobal("fetch", async () => new Response("nope", { status: 404 }));
    expect((await get("sparkwright/assets/hero.webp")).status).toBe(404);

    vi.stubGlobal("fetch", async () => new Response("boom", { status: 500 }));
    const bad = await get("sparkwright/assets/hero.webp");
    expect(bad.status).toBe(502);
    expect(await bad.text()).toMatch(/sites origin answered 500/);

    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });
    const dead = await get("sparkwright/assets/hero.webp");
    expect(dead.status).toBe(502);
    expect(await dead.text()).toMatch(/sites origin unreachable: ECONNREFUSED/);
  });
});
