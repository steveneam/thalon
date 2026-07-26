import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, videoTakePosterSchema, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import {
  backfillTakePosters,
  createFakePosterExtractor,
  derivePoster,
  POSTER_WIDTH,
  resolveTakeFile,
  takeHasPoster,
} from "../poster";

/**
 * B-media.0 (s77) write moment 2 — poster derivation, the backfill door and
 * the binary-presence gate. Hermetic by construction: the extractor seam is
 * faked, so nothing here spawns a real ffmpeg or reads a real video file.
 */

const roots: string[] = [];
let handle: DbHandle | undefined;

function newStore(): LocalObjectStore {
  const root = mkdtempSync(path.join(tmpdir(), "thalon-poster-"));
  roots.push(root);
  return new LocalObjectStore(root);
}

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const MEDIA_ROOT = "/box/projects/concept-film";
const DERIVED_AT = "2026-07-26T04:00:00.000Z";

describe("derivePoster", () => {
  it("stores the frame under media/<sha>.webp and returns a contract-valid derived envelope", async () => {
    const store = newStore();
    const extractor = createFakePosterExtractor({ width: 640, height: 360 });

    const outcome = await derivePoster(
      { kind: "motion", file: `${MEDIA_ROOT}/keepers/beat-01.mp4` },
      { store, extractor, derivedAt: DERIVED_AT },
    );

    expect(outcome.status).toBe("derived");
    if (outcome.status !== "derived") return;

    const bytes = (
      await extractor.extract(`${MEDIA_ROOT}/keepers/beat-01.mp4`, {
        maxWidth: POSTER_WIDTH,
        seekSeconds: 1,
      })
    ).bytes;
    const sha = createHash("sha256").update(bytes).digest("hex");

    // The key family lane A's /api/media door reads, composed through objectKey.
    expect(outcome.key).toBe(`media/${sha}.webp`);
    expect(await store.get(outcome.key)).toEqual(bytes);
    expect(outcome.storedNow).toBe(true);

    // Contract-valid, stored-kind, derived, measured.
    expect(videoTakePosterSchema.safeParse(outcome.poster).success).toBe(true);
    expect(outcome.poster).toEqual({
      ref: { kind: "stored", sha256: sha, ext: "webp", width: 640, height: 360, bytes: bytes.length },
      provenance: "derived",
      capturedAt: DERIVED_AT,
    });
  });

  it("omits capturedAt when the caller records no time — absent is a fact, a fabricated stamp is not", async () => {
    const outcome = await derivePoster(
      { kind: "motion", file: `${MEDIA_ROOT}/keepers/beat-02.mp4` },
      { store: newStore(), extractor: createFakePosterExtractor() },
    );
    expect(outcome.status).toBe("derived");
    if (outcome.status !== "derived") return;
    expect("capturedAt" in outcome.poster).toBe(false);
  });

  it("is content-addressed: identical frames re-derive without rewriting the object", async () => {
    const store = newStore();
    const deps = { store, extractor: createFakePosterExtractor(), derivedAt: DERIVED_AT };
    const source = { kind: "motion", file: `${MEDIA_ROOT}/keepers/beat-03.mp4` };

    const first = await derivePoster(source, deps);
    const second = await derivePoster(source, deps);
    expect(first.status === "derived" && first.storedNow).toBe(true);
    expect(second.status === "derived" && second.storedNow).toBe(false);
    expect(first.status === "derived" && second.status === "derived" && first.key === second.key).toBe(
      true,
    );
    expect(await store.list("media/")).toHaveLength(1);
  });

  it("THE GATE: no ffmpeg on the box is `pending`, never a throw — a missing binary never takes down a render", async () => {
    const outcome = await derivePoster(
      { kind: "motion", file: `${MEDIA_ROOT}/keepers/beat-01.mp4` },
      { store: newStore(), extractor: createFakePosterExtractor({ available: false }) },
    );
    expect(outcome).toMatchObject({ status: "pending", why: "binaries-absent" });
    if (outcome.status !== "pending") return;
    expect(outcome.detail).toContain("poster pending");
  });

  it("an audio take is `not-visual`, and it never touches the filesystem to find that out", async () => {
    let extracted = 0;
    const outcome = await derivePoster(
      { kind: "audio", file: `${MEDIA_ROOT}/music-candidates/bed-a.mp3` },
      {
        store: newStore(),
        extractor: {
          name: "counting",
          available: () => {
            extracted += 1;
            return Promise.resolve(true);
          },
          extract: () => {
            extracted += 1;
            return Promise.reject(new Error("must not be called"));
          },
        },
      },
    );
    expect(outcome).toEqual({ status: "pending", why: "not-visual" });
    expect(extracted).toBe(0);
  });

  it("unreadable bytes degrade to `pending` with the refusal carried whole", async () => {
    const file = `${MEDIA_ROOT}/keepers/beat-truncated.mp4`;
    const outcome = await derivePoster(
      { kind: "motion", file },
      { store: newStore(), extractor: createFakePosterExtractor({ unreadable: [file] }) },
    );
    expect(outcome).toMatchObject({ status: "pending", why: "unreadable" });
    if (outcome.status !== "pending") return;
    expect(outcome.detail).toContain("no video stream with measurable dimensions");
  });

  it("never upscales: a take narrower than the poster width keeps its own", async () => {
    const outcome = await derivePoster(
      { kind: "still", file: `${MEDIA_ROOT}/keepers/small.png` },
      { store: newStore(), extractor: createFakePosterExtractor({ width: 320, height: 200 }) },
    );
    expect(outcome.status === "derived" && outcome.poster.ref.width).toBe(320);
  });
});

describe("resolveTakeFile — the second containment wall", () => {
  it("joins a project-relative ref onto the media root", () => {
    expect(resolveTakeFile("/box/p", "keepers/beat-01.mp4")).toBe("/box/p/keepers/beat-01.mp4");
  });

  it("refuses anything that escapes the root, even though the contract already forbids it at the write door", () => {
    expect(() => resolveTakeFile("/box/p", "../../etc/passwd")).toThrow(/escapes the project media root/);
    expect(() => resolveTakeFile("/box/p", "/etc/passwd")).toThrow(/escapes the project media root/);
  });
});

describe("takeHasPoster", () => {
  it("is true only for a READABLE envelope — a malformed one is a row to re-derive, not a poster", () => {
    const good = {
      posterRef: {
        ref: { kind: "stored", sha256: "a".repeat(64), ext: "webp" },
        provenance: "derived",
      },
    };
    expect(takeHasPoster(good)).toBe(true);
    expect(takeHasPoster({})).toBe(false);
    expect(takeHasPoster(null)).toBe(false);
    expect(takeHasPoster({ posterRef: { ref: { kind: "external", url: "https://x.test/a.jpg" } } })).toBe(
      false,
    );
  });
});

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos; projectId: string }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  const { project } = await repos.videoProjects.create(ctx, {
    name: "concept film",
    meta: { mediaRoot: MEDIA_ROOT },
  });
  return { ctx, repos, projectId: project.id };
}

describe("backfillTakePosters — the lead-runnable door", () => {
  it("stamps meta.posterRef on every visual take and lights the resolver up", async () => {
    const { ctx, repos, projectId } = await setup();
    await repos.videoTakes.record(ctx, projectId, {
      slot: "beat-01",
      kind: "motion",
      ref: "keepers/beat-01.mp4",
    });
    await repos.videoTakes.record(ctx, projectId, {
      slot: "beat-02",
      kind: "motion",
      ref: "keepers/beat-02.mp4",
    });
    await repos.videoTakes.record(ctx, projectId, { kind: "audio", ref: "music-candidates/bed-a.mp3" });

    const result = await backfillTakePosters(ctx, repos, projectId, {
      mediaRoot: MEDIA_ROOT,
      store: newStore(),
      extractor: createFakePosterExtractor(),
      derivedAt: DERIVED_AT,
    });

    expect(result).toMatchObject({ derived: 2, already: 0, pending: 1 });
    expect(result.takes.find((t) => t.ref.endsWith("bed-a.mp3"))).toMatchObject({
      status: "pending",
      why: "not-visual",
    });

    const takes = await repos.videoTakes.list(ctx, projectId);
    for (const take of takes.filter((t) => t.kind === "motion")) {
      const parsed = videoTakePosterSchema.safeParse(
        (take.meta as { posterRef?: unknown }).posterRef,
      );
      expect(parsed.success).toBe(true);
      expect(parsed.success && parsed.data.provenance).toBe("derived");
    }
  });

  it("IS IDEMPOTENT: a second run re-derives nothing and never touches the extractor again", async () => {
    const { ctx, repos, projectId } = await setup();
    await repos.videoTakes.record(ctx, projectId, { kind: "motion", ref: "keepers/beat-01.mp4" });

    const store = newStore();
    const first = await backfillTakePosters(ctx, repos, projectId, {
      mediaRoot: MEDIA_ROOT,
      store,
      extractor: createFakePosterExtractor(),
      derivedAt: DERIVED_AT,
    });
    expect(first).toMatchObject({ derived: 1, already: 0 });
    const after = (await repos.videoTakes.list(ctx, projectId))[0];

    let calls = 0;
    const counting = createFakePosterExtractor();
    const second = await backfillTakePosters(ctx, repos, projectId, {
      mediaRoot: MEDIA_ROOT,
      store,
      extractor: {
        ...counting,
        extract: (file, opts) => {
          calls += 1;
          return counting.extract(file, opts);
        },
      },
      derivedAt: "2026-07-27T04:00:00.000Z",
    });

    expect(second).toMatchObject({ derived: 0, already: 1, pending: 0 });
    expect(calls).toBe(0);
    // The stamp is untouched — a re-run is a no-op, not a re-derive.
    const again = (await repos.videoTakes.list(ctx, projectId))[0];
    expect(again.meta).toEqual(after.meta);
  });

  it("one unreadable take never costs the others their posters", async () => {
    const { ctx, repos, projectId } = await setup();
    await repos.videoTakes.record(ctx, projectId, { kind: "motion", ref: "keepers/beat-01.mp4" });
    await repos.videoTakes.record(ctx, projectId, { kind: "motion", ref: "keepers/broken.mp4" });

    const lines: string[] = [];
    const result = await backfillTakePosters(ctx, repos, projectId, {
      mediaRoot: MEDIA_ROOT,
      store: newStore(),
      extractor: createFakePosterExtractor({ unreadable: [`${MEDIA_ROOT}/keepers/broken.mp4`] }),
      derivedAt: DERIVED_AT,
      log: (line) => lines.push(line),
    });

    expect(result).toMatchObject({ derived: 1, pending: 1 });
    expect(lines.some((l) => l.includes("broken.mp4") && l.includes("poster pending"))).toBe(true);
  });

  it("with no binaries the whole run is honest `pending` and nothing is stamped", async () => {
    const { ctx, repos, projectId } = await setup();
    await repos.videoTakes.record(ctx, projectId, { kind: "motion", ref: "keepers/beat-01.mp4" });

    const result = await backfillTakePosters(ctx, repos, projectId, {
      mediaRoot: MEDIA_ROOT,
      store: newStore(),
      extractor: createFakePosterExtractor({ available: false }),
    });

    expect(result).toMatchObject({ derived: 0, pending: 1 });
    expect((await repos.videoTakes.list(ctx, projectId))[0].meta).toEqual({});
  });
});

describe("videoTakes.setPoster — the validated write door", () => {
  it("refuses an external ref (a poster is bytes we hold) and a bad envelope", async () => {
    const { ctx, repos, projectId } = await setup();
    const { take } = await repos.videoTakes.record(ctx, projectId, {
      kind: "motion",
      ref: "keepers/beat-01.mp4",
    });
    await expect(
      repos.videoTakes.setPoster(ctx, take.id, {
        ref: { kind: "external", url: "https://cdn.test/a.jpg" },
        provenance: "derived",
      } as never),
    ).rejects.toThrow();
    // Invariant 3: orientation is derived, never stored — strictObject refuses it.
    await expect(
      repos.videoTakes.setPoster(ctx, take.id, {
        ref: { kind: "stored", sha256: "b".repeat(64), ext: "webp" },
        provenance: "derived",
        orientation: "landscape",
      } as never),
    ).rejects.toThrow();
  });

  it("re-stamping the identical poster is a silent no-op; a different frame replaces it", async () => {
    const { ctx, repos, projectId } = await setup();
    const { take } = await repos.videoTakes.record(ctx, projectId, {
      kind: "motion",
      ref: "keepers/beat-01.mp4",
    });
    const poster = {
      ref: { kind: "stored" as const, sha256: "c".repeat(64), ext: "webp" as const },
      provenance: "derived" as const,
    };
    expect((await repos.videoTakes.setPoster(ctx, take.id, poster)).stamped).toBe(true);
    expect((await repos.videoTakes.setPoster(ctx, take.id, poster)).stamped).toBe(false);

    const replaced = await repos.videoTakes.setPoster(ctx, take.id, {
      ...poster,
      ref: { ...poster.ref, sha256: "d".repeat(64) },
      provenance: "operator",
    });
    expect(replaced.stamped).toBe(true);
    expect((replaced.take.meta as { posterRef: { ref: { sha256: string } } }).posterRef.ref.sha256).toBe(
      "d".repeat(64),
    );
  });

  it("the tenancy wall holds: a foreign tenant cannot stamp a poster", async () => {
    const { ctx, repos, projectId } = await setup();
    const { take } = await repos.videoTakes.record(ctx, projectId, {
      kind: "motion",
      ref: "keepers/beat-01.mp4",
    });
    const other = tenantCtx((await repos.tenants.create({ slug: "other", name: "Other" })).id);
    await expect(
      repos.videoTakes.setPoster(other, take.id, {
        ref: { kind: "stored", sha256: "e".repeat(64), ext: "webp" },
        provenance: "derived",
      }),
    ).rejects.toThrow();
  });
});
