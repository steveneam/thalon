import { mkdtempSync, rmSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TTS_VOICE,
  KOKORO_MODEL,
  createFakeNarrationDriver,
  createKokoroNarrationDriver,
  narrationCacheKey,
  wavDurationMs,
  withNarrationCache,
  type KokoroTtsRunner,
  type NarrationDriver,
} from "../narration";

const cleanupDirs: string[] = [];
afterEach(() => {
  for (const dir of cleanupDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(tag: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), `thalon-narr-${tag}-`));
  cleanupDirs.push(dir);
  return dir;
}

describe("wavDurationMs", () => {
  it("round-trips the fake driver's crafted WAV exactly", async () => {
    const artifact = await createFakeNarrationDriver().synthesize({ text: "Twelve chars", voice: "af_heart" });
    expect(wavDurationMs(artifact.wav)).toBe(artifact.durationMs);
  });

  it("walks past extra chunks to find data (metadata cannot fool it)", async () => {
    const { wav } = await createFakeNarrationDriver().synthesize({ text: "hi", voice: "v" });
    // Splice a LIST chunk between fmt and data.
    const list = Buffer.alloc(8 + 4);
    list.write("LIST", 0, "ascii");
    list.writeUInt32LE(4, 4);
    const spliced = Buffer.concat([wav.subarray(0, 36), list, wav.subarray(36)]);
    spliced.writeUInt32LE(spliced.length - 8, 4);
    expect(wavDurationMs(spliced)).toBe(wavDurationMs(wav));
  });

  it("is loud on non-WAV bytes", () => {
    expect(() => wavDurationMs(Buffer.from("not audio at all, sorry"))).toThrow(/RIFF\/WAVE/);
  });
});

describe("createFakeNarrationDriver", () => {
  it("is deterministic and keyless: same text, same bytes, estimated word timings inside the audio window", async () => {
    const driver = createFakeNarrationDriver();
    const a = await driver.synthesize({ text: "Know what's rising before you post.", voice: DEFAULT_TTS_VOICE });
    const b = await driver.synthesize({ text: "Know what's rising before you post.", voice: DEFAULT_TTS_VOICE });
    expect(a.wav.equals(b.wav)).toBe(true);
    expect(a.words).toEqual(b.words);
    expect(a.alignment).toBe("estimated");
    expect(a.words.length).toBe(6);
    expect(a.words[0].startMs).toBeGreaterThanOrEqual(0);
    expect(a.words[a.words.length - 1].endMs).toBeLessThanOrEqual(a.durationMs);
  });
});

describe("narrationCacheKey", () => {
  it("pins the content address: text × voice × model", () => {
    const key = narrationCacheKey(KOKORO_MODEL, "af_heart", "Hello.");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(narrationCacheKey(KOKORO_MODEL, "af_heart", "Hello.")).toBe(key);
    expect(narrationCacheKey(KOKORO_MODEL, "af_nova", "Hello.")).not.toBe(key);
    expect(narrationCacheKey("other-model", "af_heart", "Hello.")).not.toBe(key);
    expect(narrationCacheKey(KOKORO_MODEL, "af_heart", "Hello!")).not.toBe(key);
  });
});

describe("withNarrationCache", () => {
  function countingDriver(): { driver: NarrationDriver; calls: () => number } {
    let calls = 0;
    const inner = createFakeNarrationDriver();
    return {
      driver: {
        name: "counting",
        model: inner.model,
        synthesize: (req) => {
          calls += 1;
          return inner.synthesize(req);
        },
      },
      calls: () => calls,
    };
  }

  it("misses once, then replays from disk without invoking the driver — the demo CLI's free second pass", async () => {
    const dir = tempDir("cache");
    const { driver, calls } = countingDriver();
    const cached = withNarrationCache(driver, dir);
    const first = await cached.synthesize({ text: "Approve → ship", voice: "af_heart" });
    const second = await cached.synthesize({ text: "Approve → ship", voice: "af_heart" });
    expect(calls()).toBe(1);
    expect(second.wav.equals(first.wav)).toBe(true);
    expect(second.words).toEqual(first.words);
    expect(second.durationMs).toBe(first.durationMs);
  });

  it("stores under the content address with narration.json as the commit marker", async () => {
    const dir = tempDir("layout");
    const cached = withNarrationCache(createFakeNarrationDriver(), dir);
    await cached.synthesize({ text: "One queue.", voice: "af_heart" });
    const key = narrationCacheKey("fake-tts.v1", "af_heart", "One queue.");
    const entries = await readdir(path.join(dir, key));
    expect(entries.sort()).toEqual(["narration.json", "speech.wav"]);
  });

  it("a wav without its commit marker is a miss (re-synthesized), a marker without audio is loud", async () => {
    const dir = tempDir("marker");
    const { driver, calls } = countingDriver();
    const cached = withNarrationCache(driver, dir);
    const key = narrationCacheKey(driver.model, "af_heart", "Half written");

    // Orphan wav, no marker → treated as a miss.
    const entryDir = path.join(dir, key);
    await (await import("node:fs/promises")).mkdir(entryDir, { recursive: true });
    await writeFile(path.join(entryDir, "speech.wav"), Buffer.from("junk"));
    await cached.synthesize({ text: "Half written", voice: "af_heart" });
    expect(calls()).toBe(1);
    // The re-synthesis committed properly.
    expect((await readFile(path.join(entryDir, "narration.json"), "utf8")).length).toBeGreaterThan(2);

    // Marker without audio → loud, never a silent fake hit.
    const key2 = narrationCacheKey(driver.model, "af_heart", "Corrupt entry");
    const entry2 = path.join(dir, key2);
    await (await import("node:fs/promises")).mkdir(entry2, { recursive: true });
    await writeFile(
      path.join(entry2, "narration.json"),
      JSON.stringify({ model: driver.model, voice: "af_heart", text: "Corrupt entry", durationMs: 100, alignment: "estimated", words: [] }),
    );
    await expect(cached.synthesize({ text: "Corrupt entry", voice: "af_heart" })).rejects.toThrow();
  });
});

describe("createKokoroNarrationDriver", () => {
  it("passes the text as a FILE to the injected runner, measures the produced wav, and estimates alignment against real duration", async () => {
    const runnerCalls: Array<{ text: string; voice: string }> = [];
    const fakeWav = (await createFakeNarrationDriver({ msPerChar: 100 }).synthesize({ text: "0123456789", voice: "x" })).wav;
    const runner: KokoroTtsRunner = {
      async run(textFile, voice, outWavPath) {
        runnerCalls.push({ text: await readFile(textFile, "utf8"), voice });
        await writeFile(outWavPath, fakeWav);
      },
    };
    const driver = createKokoroNarrationDriver({ runner, workDir: tempDir("kokoro") });
    expect(driver.model).toBe(KOKORO_MODEL);
    const artifact = await driver.synthesize({ text: "Quotes \"and\" $pecial 'chars' survive files.", voice: "bf_emma" });
    expect(runnerCalls).toEqual([{ text: "Quotes \"and\" $pecial 'chars' survive files.", voice: "bf_emma" }]);
    expect(artifact.durationMs).toBe(wavDurationMs(fakeWav));
    expect(artifact.alignment).toBe("estimated");
    expect(artifact.words[artifact.words.length - 1].endMs).toBeLessThanOrEqual(artifact.durationMs);
    expect(artifact.voice).toBe("bf_emma");
  });

  it("surfaces the runner's refusal verbatim (the keyless stack's loud remedy)", async () => {
    const runner: KokoroTtsRunner = {
      run: () => Promise.reject(new Error("kokoro tts refused: The kokoro-onnx package is not installed. Run: pip install kokoro-onnx soundfile")),
    };
    const driver = createKokoroNarrationDriver({ runner, workDir: tempDir("refuse") });
    await expect(driver.synthesize({ text: "hi", voice: DEFAULT_TTS_VOICE })).rejects.toThrow(/kokoro-onnx/);
  });
});
