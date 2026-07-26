import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { audioRefEnvelopeSchema, tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import {
  AudioBedRejected,
  bedVolumeFromGainDb,
  configureProjectAudioBed,
  DEFAULT_BED_VOLUME,
  projectAudioBed,
  readAudioBed,
  resolveProjectBed,
  storeAudioBed,
  withMusicBed,
  type AudioBedLicense,
} from "../audio-bed";
import type { PillarRenderManifest } from "../target";

/**
 * B-audio.1 (s77) — the bed source, the licence gate and the mux.
 *
 * NO AUDIO FILE LIVES IN-TREE, not even as a fixture (founder-ratified,
 * `narration.ts:34-36`). Every byte below is synthesized: real container
 * headers over silence, so the mislabel guard is exercised honestly.
 */

let handle: DbHandle | undefined;
const roots: string[] = [];

function newStore(): LocalObjectStore {
  const root = mkdtempSync(path.join(tmpdir(), "thalon-bed-"));
  roots.push(root);
  return new LocalObjectStore(root);
}

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A minimal, real RIFF/WAVE header over N bytes of 8-bit silence — synthesized, never committed. */
function silentWav(samples = 64): Buffer {
  const wav = Buffer.alloc(44 + samples);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(36 + samples, 4);
  wav.write("WAVE", 8, "ascii");
  wav.write("fmt ", 12, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8_000, 24);
  wav.writeUInt32LE(8_000, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(samples, 40);
  wav.fill(128, 44);
  return wav;
}

/** An ID3-tagged stub: enough to be an honest mp3 label, no audio claimed. */
function id3Mp3(): Buffer {
  return Buffer.concat([Buffer.from("ID3\x03\x00\x00\x00\x00\x00\x00", "binary"), Buffer.alloc(32)]);
}

const LICENSE: AudioBedLicense = {
  license: "CC0 1.0",
  source: "operator upload — public-domain library",
  attestedBy: "steven",
  attestedAt: "2026-07-26T04:00:00.000Z",
};

describe("storeAudioBed — bytes become an operator-provenance envelope", () => {
  it("stores under media/<sha>.<ext> and returns a contract-valid stored-audio envelope", async () => {
    const store = newStore();
    const bytes = silentWav();
    const stored = await storeAudioBed(store, {
      bytes,
      ext: "wav",
      storedAt: "2026-07-26T04:00:00.000Z",
      alt: "warm piano bed",
    });

    expect(stored.key).toMatch(/^media\/[0-9a-f]{64}\.wav$/);
    expect(stored.storedNow).toBe(true);
    expect(await store.get(stored.key)).toEqual(bytes);
    expect(audioRefEnvelopeSchema.safeParse(stored.envelope).success).toBe(true);
    expect(stored.envelope).toEqual({
      ref: {
        kind: "stored",
        sha256: stored.key.slice("media/".length, -".wav".length),
        ext: "wav",
        bytes: bytes.length,
      },
      provenance: "operator",
      capturedAt: "2026-07-26T04:00:00.000Z",
      alt: "warm piano bed",
    });
  });

  it("is content-addressed: the same track uploaded twice is one object", async () => {
    const store = newStore();
    const bytes = silentWav();
    const first = await storeAudioBed(store, { bytes, ext: "wav" });
    const second = await storeAudioBed(store, { bytes, ext: "wav" });
    expect(second.key).toBe(first.key);
    expect(second.storedNow).toBe(false);
    expect(await store.list("media/")).toHaveLength(1);
  });

  it("refuses an empty body and a mislabelled container BEFORE it can fail at render time", async () => {
    const store = newStore();
    await expect(storeAudioBed(store, { bytes: Buffer.alloc(0), ext: "wav" })).rejects.toBeInstanceOf(
      AudioBedRejected,
    );
    // A PNG called mp3: the failure this guard exists to move forward in time.
    await expect(
      storeAudioBed(store, { bytes: Buffer.from("\x89PNG\r\n\x1a\n", "binary"), ext: "mp3" }),
    ).rejects.toThrow(/do not look like mp3/);
    // …and a real mp3 label passes.
    await expect(storeAudioBed(store, { bytes: id3Mp3(), ext: "mp3" })).resolves.toMatchObject({
      storedNow: true,
    });
    expect(await store.list("media/")).toHaveLength(1);
  });

  it("omits capturedAt when the caller records no time", async () => {
    const stored = await storeAudioBed(newStore(), { bytes: silentWav(), ext: "wav" });
    expect("capturedAt" in stored.envelope).toBe(false);
  });
});

describe("readAudioBed", () => {
  it("round-trips the bytes and answers null when the object is gone", async () => {
    const store = newStore();
    const bytes = silentWav();
    const stored = await storeAudioBed(store, { bytes, ext: "wav" });
    expect(await readAudioBed(store, stored.envelope)).toEqual(bytes);
    await store.delete(stored.key);
    expect(await readAudioBed(store, stored.envelope)).toBeNull();
  });
});

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos; projectId: string }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  const { project } = await repos.videoProjects.create(ctx, { name: "concept film" });
  return { ctx, repos, projectId: project.id };
}

describe("configureProjectAudioBed — the licence gate is executable, not remembered", () => {
  it("stores the track and points the project at it, licence on the record", async () => {
    const { ctx, repos, projectId } = await setup();
    const store = newStore();

    const stored = await configureProjectAudioBed(ctx, repos, projectId, store, {
      bytes: silentWav(),
      ext: "wav",
      license: LICENSE,
      storedAt: "2026-07-26T04:00:00.000Z",
    });

    const project = (await repos.videoProjects.get(ctx, projectId))!;
    const configured = projectAudioBed(project.meta);
    expect(configured).not.toBeNull();
    expect(configured!.bed).toEqual(stored.envelope);
    expect(configured!.license).toEqual(LICENSE);
  });

  it("refuses a bed whose licence nobody stated — and stores NOTHING when it does", async () => {
    const { ctx, repos, projectId } = await setup();
    const store = newStore();

    await expect(
      configureProjectAudioBed(ctx, repos, projectId, store, {
        bytes: silentWav(),
        ext: "wav",
        license: { ...LICENSE, license: "" },
      }),
    ).rejects.toThrow();
    await expect(
      configureProjectAudioBed(ctx, repos, projectId, store, {
        bytes: silentWav(),
        ext: "wav",
        license: { source: "somewhere" } as never,
      }),
    ).rejects.toThrow();

    expect(await store.list("media/")).toHaveLength(0);
    expect(projectAudioBed((await repos.videoProjects.get(ctx, projectId))!.meta)).toBeNull();
  });

  it("the repo door holds its own floor even when called directly", async () => {
    const { ctx, repos, projectId } = await setup();
    const stored = await storeAudioBed(newStore(), { bytes: silentWav(), ext: "wav" });
    await expect(
      repos.videoProjects.setAudioBed(ctx, projectId, { bed: stored.envelope, license: {} }),
    ).rejects.toThrow(/attested, never assumed/);
    // Audio is stored-only by contract: an external bed cannot be expressed.
    await expect(
      repos.videoProjects.setAudioBed(ctx, projectId, {
        bed: { ref: { kind: "external", url: "https://cdn.test/bed.mp3" }, provenance: "operator" } as never,
        license: { license: "CC0", source: "x" },
      }),
    ).rejects.toThrow();
  });
});

describe("projectAudioBed — a malformed value is 'no bed', never a broken render", () => {
  it("degrades to null on absent, junk and half-written values", () => {
    expect(projectAudioBed(null)).toBeNull();
    expect(projectAudioBed({})).toBeNull();
    expect(projectAudioBed({ audioBed: "a track, honest" })).toBeNull();
    expect(projectAudioBed({ audioBed: { bed: { ref: { kind: "stored" } } } })).toBeNull();
  });
});

describe("bedVolumeFromGainDb", () => {
  it("maps the music lane's dB onto the composition's linear 0–1, clamped", () => {
    expect(bedVolumeFromGainDb(0)).toBe(1);
    expect(bedVolumeFromGainDb(-6)).toBeCloseTo(0.501, 3);
    expect(bedVolumeFromGainDb(-20)).toBeCloseTo(0.1, 3);
    // A boost cannot exceed full scale, and nonsense falls back rather than NaN-ing a render.
    expect(bedVolumeFromGainDb(12)).toBe(1);
    expect(bedVolumeFromGainDb(Number.NaN)).toBe(DEFAULT_BED_VOLUME);
  });
});

describe("resolveProjectBed — 'no bed configured' and 'the bytes are gone' are different facts", () => {
  it("resolves a configured bed to render-ready bytes at the cue's level", async () => {
    const { ctx, repos, projectId } = await setup();
    const store = newStore();
    await configureProjectAudioBed(ctx, repos, projectId, store, {
      bytes: silentWav(),
      ext: "wav",
      license: LICENSE,
    });
    const project = (await repos.videoProjects.get(ctx, projectId))!;

    const resolved = await resolveProjectBed(store, project.meta, { gainDb: -6 });
    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") return;
    expect(resolved.bed.ext).toBe("wav");
    expect(resolved.bed.bytes).toEqual(silentWav());
    expect(resolved.bed.volume).toBeCloseTo(0.501, 3);
    expect(resolved.license).toEqual(LICENSE);

    // No gain stated = the film's own bed level, not silence and not full.
    expect(await resolveProjectBed(store, project.meta)).toMatchObject({
      bed: { volume: DEFAULT_BED_VOLUME },
    });
  });

  it("says none-configured for a silent project and bytes-missing for a lost track", async () => {
    const { ctx, repos, projectId } = await setup();
    const store = newStore();
    expect(await resolveProjectBed(store, {})).toEqual({ status: "omitted", why: "none-configured" });

    const stored = await configureProjectAudioBed(ctx, repos, projectId, store, {
      bytes: silentWav(),
      ext: "wav",
      license: LICENSE,
    });
    const project = (await repos.videoProjects.get(ctx, projectId))!;
    await store.delete(stored.key);
    expect(await resolveProjectBed(store, project.meta)).toEqual({
      status: "omitted",
      why: "bytes-missing",
    });
  });
});

const MANIFEST = {
  timeline: { cues: [{}, {}, {}] },
} as unknown as PillarRenderManifest;

describe("withMusicBed — THE MUX: a rendered cut carries its music, or states why not", () => {
  it("attaches the bed to a bed-less bundle, aligned to the manifest's cue count", async () => {
    const store = newStore();
    const bytes = silentWav();
    const stored = await storeAudioBed(store, { bytes, ext: "wav" });
    const meta = { audioBed: { bed: stored.envelope, license: LICENSE } };

    const provider = withMusicBed(null, () => resolveProjectBed(store, meta, { gainDb: -6 }));
    const bundle = await provider(MANIFEST);

    expect(bundle).not.toBeNull();
    expect(bundle!.narration).toEqual([null, null, null]);
    expect(bundle!.bed).toMatchObject({ ext: "wav", bytes });
    expect(bundle!.bed!.volume).toBeCloseTo(0.501, 3);
  });

  it("keeps an inner provider's narration and only adds the bed", async () => {
    const store = newStore();
    const stored = await storeAudioBed(store, { bytes: silentWav(), ext: "mp3" as never }).catch(
      () => null,
    );
    expect(stored).toBeNull(); // the mislabel guard again — a wav is not an mp3

    const real = await storeAudioBed(store, { bytes: id3Mp3(), ext: "mp3" });
    const meta = { audioBed: { bed: real.envelope, license: LICENSE } };
    const inner = () =>
      Promise.resolve({
        narration: [{ wav: silentWav(), durationMs: 8, words: [] }, null, null],
        sfx: [null, null, null],
      });

    const bundle = await withMusicBed(inner, () => resolveProjectBed(store, meta))(MANIFEST);
    expect(bundle!.narration).toHaveLength(3);
    expect(bundle!.narration[0]).not.toBeNull();
    expect(bundle!.bed).toMatchObject({ ext: "mp3" });
  });

  it("STATES the omission rather than letting a render go quietly silent", async () => {
    const store = newStore();
    const seen: string[] = [];
    const bundle = await withMusicBed(null, () => resolveProjectBed(store, {}), {
      onOmitted: (why) => seen.push(why),
    })(MANIFEST);

    expect(seen).toEqual(["none-configured"]);
    expect(bundle!.bed).toBeUndefined();
  });
});
