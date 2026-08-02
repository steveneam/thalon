import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { captionFileProvider, createFakeEmbeddingDriver } from "@thalon/engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runVideoIngest } from "@/lib/library/ingest";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { GET } = await import("./route");
const { POST } = await import("./ingest/route");
const { GET: GET_TRANSCRIPT } = await import("./[sourceId]/transcript/route");

let handle: DbHandle | undefined;
let dataDir: string | undefined;
let savedDataDir: string | undefined;

beforeEach(async () => {
  handle = await openTestDb();
  repos = handle.repos;
  // Point the object-store seam at a throwaway root so the transcript READ
  // route exercises the real getObjectStore() path, not a mock.
  savedDataDir = process.env.THALON_DATA_DIR;
  dataDir = mkdtempSync(path.join(tmpdir(), "thalon-library-"));
  process.env.THALON_DATA_DIR = dataDir;
});

afterEach(async () => {
  repos = undefined;
  await handle?.close();
  handle = undefined;
  if (savedDataDir === undefined) delete process.env.THALON_DATA_DIR;
  else process.env.THALON_DATA_DIR = savedDataDir;
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  dataDir = undefined;
});

const SRT = `1
00:00:00,037 --> 00:00:01,357
McKinsey is dead.

2
00:00:01,357 --> 00:00:03,307
Boston Consulting Group is dead.
`;

/** Ingest through the lib with injected keyless deps — the same door the POST route calls, minus live drivers. */
async function seedTranscript(url: string) {
  const ctx = { tenantId: (await repos!.tenants.getBySlug("self"))!.id };
  return runVideoIngest(repos!, ctx, { url, captions: SRT }, {
    transcriptProvider: captionFileProvider(),
    embedder: createFakeEmbeddingDriver(),
  });
}

describe("/api/library", () => {
  it("lists nothing unseeded but still reports the transcript seam honestly", async () => {
    const body = await (await GET()).json();
    expect(body.sources).toEqual([]);
    expect(body.seam).toMatchObject({
      selected: "caption-file",
      vendorConfigured: false,
    });
    expect(body.seam.registered).toContain("hosted-vendor");
  });

  it("round-trips: ingest → shelf row → transcript read with timed segments", async () => {
    await repos!.tenants.create({ slug: "self", name: "Self" });
    const result = await seedTranscript("https://www.youtube.com/watch?v=tZQ9SNw4TYQ");
    expect(result.created).toBe(true);
    expect(result.provider).toBe("caption-file");

    const list = await (await GET()).json();
    expect(list.sources).toHaveLength(1);
    expect(list.sources[0]).toMatchObject({
      uri: "https://www.youtube.com/watch?v=tZQ9SNw4TYQ",
      provider: "caption-file",
      segmentCount: 2,
    });

    const res = await GET_TRANSCRIPT(new Request("http://localhost/api/library/x/transcript"), {
      params: Promise.resolve({ sourceId: result.sourceId }),
    });
    expect(res.status).toBe(200);
    const transcript = await res.json();
    expect(transcript.provider).toBe("caption-file");
    expect(transcript.segments).toEqual([
      { text: "McKinsey is dead.", startMs: 37, endMs: 1_357 },
      { text: "Boston Consulting Group is dead.", startMs: 1_357, endMs: 3_307 },
    ]);
  });

  it("lists every non-prompt kind with `kind` on the wire — §5.3's one shelf (s94)", async () => {
    await repos!.tenants.create({ slug: "self", name: "Self" });
    const ctx = { tenantId: (await repos!.tenants.getBySlug("self"))!.id };
    await seedTranscript("https://www.youtube.com/watch?v=tZQ9SNw4TYQ");
    await repos!.sources.create(ctx, {
      kind: "url",
      uri: "https://example.com/deterministic-rendering",
      contentHash: "hash-url-1",
      meta: {},
    });
    // A run's captured brief is per-run provenance, not a shelf item.
    await repos!.sources.create(ctx, {
      kind: "prompt",
      contentHash: "hash-prompt-1",
      meta: {},
    });

    const list = await (await GET()).json();
    expect(list.sources).toHaveLength(2);
    const kinds = list.sources.map((s: { kind: string }) => s.kind).sort();
    expect(kinds).toEqual(["url", "video_transcript"]);
    expect(kinds).not.toContain("prompt");
  });

  it("re-ingesting the same captions is the zero-embed fast path (content identity = the transcript)", async () => {
    await repos!.tenants.create({ slug: "self", name: "Self" });
    const first = await seedTranscript("https://www.youtube.com/watch?v=tZQ9SNw4TYQ");
    const second = await seedTranscript("https://youtu.be/tZQ9SNw4TYQ");
    expect(second.created).toBe(false);
    expect(second.sourceId).toBe(first.sourceId);
    expect((await (await GET()).json()).sources).toHaveLength(1);
  });

  it("404s a transcript read for an unknown source id", async () => {
    await repos!.tenants.create({ slug: "self", name: "Self" });
    const res = await GET_TRANSCRIPT(new Request("http://localhost/api/library/x/transcript"), {
      params: Promise.resolve({ sourceId: "00000000-0000-4000-8000-000000000000" }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects a non-URL body loudly and 503s before a workspace profile exists", async () => {
    const bad = await POST(
      new Request("http://localhost/api/library/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "not a url" }),
      }),
    );
    expect(bad.status).toBe(400);

    const noTenant = await POST(
      new Request("http://localhost/api/library/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/v", captions: SRT }),
      }),
    );
    expect(noTenant.status).toBe(503);
  });
});
