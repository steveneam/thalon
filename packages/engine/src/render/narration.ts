import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { sha256Hex, stableStringify } from "@thalon/db";
import type { CaptionWord } from "./composition";
import { estimateCaptionWords } from "./composition-scene";

/**
 * The TTS narration seam (composition v2 / audio tier, engaging-clips §5
 * item 2): a keyless-local-first driver behind the same registry discipline
 * as every other seam — "no key configured is a normal state". The default
 * real driver is Kokoro-82M through the PINNED hyperframes CLI (0.7.33
 * lockstep, ADR-0004), spawned as an injectable subprocess runner exactly
 * like the B4.8 whisper provider — tests never synthesize.
 *
 * Word alignment is a seam of its own: the in-tree default derives word
 * timings deterministically from the MEASURED audio duration (char-weight
 * spread — the same estimator silent compositions use, but anchored to real
 * speech length) and records `alignment: "estimated"` honestly in the
 * artifact. Whisper word-level alignment (the pinned stack's
 * `hyperframes transcribe`, which needs whisper-cpp — `npm run doctor`
 * reports it) plugs into the same `align` dep when that runtime exists;
 * nothing here pretends estimated timings are transcribed ones.
 *
 * Caching is content-addressed on the INPUT (cache key = text × voice ×
 * model, ADR-0004's fallback logic): inference is not bit-stable across
 * machines and does not need to be — the key is. `narration.json` is
 * written LAST as the cache commit marker (the render-cache pattern), so a
 * crash mid-write never leaves a half-trusted entry.
 *
 * NO music bed lives here or anywhere in-tree: founder-ratified
 * (engaging-clips §6) — audio v2.5's bed is operator-licensed track DATA
 * behind the composition's `bed` slot; self-generation stays a recorded
 * future rung.
 */

export const KOKORO_MODEL = "kokoro-82M";
export const DEFAULT_TTS_VOICE = "af_heart";

export type NarrationAlignment = "whisper" | "estimated";

export interface NarrationRequest {
  text: string;
  voice: string;
}

export interface NarrationArtifact {
  wav: Buffer;
  durationMs: number;
  words: CaptionWord[];
  alignment: NarrationAlignment;
  model: string;
  voice: string;
}

export interface NarrationDriver {
  readonly name: string;
  /** Part of the cache key — a model swap re-keys every artifact. */
  readonly model: string;
  synthesize(request: NarrationRequest): Promise<NarrationArtifact>;
}

/** Word aligner seam: audio + text + measured duration → timed words. The estimated default always works; a whisper-backed one records "whisper". */
export type NarrationAligner = (
  wav: Buffer,
  text: string,
  durationMs: number,
) => Promise<{ words: CaptionWord[]; alignment: NarrationAlignment }>;

export const estimatedAligner: NarrationAligner = (wav, text, durationMs) => {
  void wav;
  return Promise.resolve({ words: estimateCaptionWords(text, durationMs), alignment: "estimated" });
};

/**
 * RIFF/WAVE duration from the header — pure byte math (no ffprobe), walks
 * chunks so extra metadata chunks cannot fool it. Loud on anything that is
 * not a plain PCM WAV.
 */
export function wavDurationMs(wav: Buffer): number {
  if (wav.length < 44 || wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("narration audio is not a RIFF/WAVE file");
  }
  let byteRate: number | null = null;
  let dataSize: number | null = null;
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const chunkId = wav.toString("ascii", offset, offset + 4);
    const chunkSize = wav.readUInt32LE(offset + 4);
    if (chunkId === "fmt ") byteRate = wav.readUInt32LE(offset + 16);
    if (chunkId === "data") {
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  if (byteRate === null || dataSize === null || byteRate === 0) {
    throw new Error("narration WAV carries no fmt/data chunk — cannot derive duration");
  }
  return Math.round((dataSize * 1000) / byteRate);
}

/** Shells the pinned CLI's `tts` — injectable so tests never synthesize (the B4.8 runner pattern). Text travels as a .txt file, never through shell quoting. */
export interface KokoroTtsRunner {
  run(textFile: string, voice: string, outWavPath: string): Promise<void>;
}

function resolvePinnedCli(): string {
  const require = createRequire(import.meta.url);
  return path.join(path.dirname(require.resolve("hyperframes/package.json")), "dist", "cli.js");
}

function defaultKokoroRunner(): KokoroTtsRunner {
  return {
    run(textFile, voice, outWavPath): Promise<void> {
      return new Promise((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [resolvePinnedCli(), "tts", textFile, "-o", outWavPath, "-v", voice, "--json"],
          {
            windowsHide: true,
            env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1", HYPERFRAMES_SKIP_SKILLS: "1" },
          },
        );
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => (stdout += d.toString()));
        child.stderr.on("data", (d) => (stderr += d.toString()));
        child.on("error", (err) => reject(new Error(`kokoro tts failed to spawn the pinned CLI: ${err.message}`)));
        child.on("close", (code) => {
          let parsed: { ok?: boolean; error?: string } | null = null;
          try {
            parsed = JSON.parse(stdout) as { ok?: boolean; error?: string };
          } catch {
            parsed = null;
          }
          if (parsed && parsed.ok === false) {
            reject(
              new Error(
                `kokoro tts refused: ${parsed.error} (the local stack is keyless but needs its user-scope runtime — see \`npx hyperframes doctor\`)`,
              ),
            );
            return;
          }
          if (code === 0) resolve();
          else reject(new Error(`kokoro tts exited ${code}: ${(stderr || stdout).slice(0, 500)}`));
        });
      });
    },
  };
}

export interface KokoroDriverDeps {
  runner?: KokoroTtsRunner;
  align?: NarrationAligner;
  /** Parent for the per-call scratch dir (default: OS temp root). */
  workDir?: string;
}

/** The default real driver: Kokoro-82M via the pinned hyperframes CLI ($0, keyless, local — Apache-2.0 model per the research doc's license read). */
export function createKokoroNarrationDriver(deps: KokoroDriverDeps = {}): NarrationDriver {
  const runner = deps.runner ?? defaultKokoroRunner();
  const align = deps.align ?? estimatedAligner;
  return {
    name: "kokoro-local",
    model: KOKORO_MODEL,
    async synthesize({ text, voice }): Promise<NarrationArtifact> {
      const scratch = await mkdtemp(path.join(deps.workDir ?? tmpdir(), "thalon-tts-"));
      try {
        const textFile = path.join(scratch, "narration.txt");
        const wavFile = path.join(scratch, "speech.wav");
        await writeFile(textFile, text, "utf8");
        await runner.run(textFile, voice, wavFile);
        const wav = await readFile(wavFile);
        const durationMs = wavDurationMs(wav);
        const { words, alignment } = await align(wav, text, durationMs);
        return { wav, durationMs, words, alignment, model: KOKORO_MODEL, voice };
      } finally {
        await rm(scratch, { recursive: true, force: true });
      }
    },
  };
}

/** Deterministic keyless test double: a tiny silent PCM WAV whose duration derives from the text — wavDurationMs round-trips it exactly. */
export function createFakeNarrationDriver(deps: { msPerChar?: number } = {}): NarrationDriver {
  const msPerChar = deps.msPerChar ?? 55;
  return {
    name: "fake-tts",
    model: "fake-tts.v1",
    synthesize({ text, voice }): Promise<NarrationArtifact> {
      const durationMs = Math.max(200, text.length * msPerChar);
      const sampleRate = 8_000;
      const samples = Math.round((durationMs * sampleRate) / 1000);
      const wav = Buffer.alloc(44 + samples);
      wav.write("RIFF", 0, "ascii");
      wav.writeUInt32LE(36 + samples, 4);
      wav.write("WAVE", 8, "ascii");
      wav.write("fmt ", 12, "ascii");
      wav.writeUInt32LE(16, 16);
      wav.writeUInt16LE(1, 20); // PCM
      wav.writeUInt16LE(1, 22); // mono
      wav.writeUInt32LE(sampleRate, 24);
      wav.writeUInt32LE(sampleRate, 28); // byte rate (8-bit mono)
      wav.writeUInt16LE(1, 32);
      wav.writeUInt16LE(8, 34);
      wav.write("data", 36, "ascii");
      wav.writeUInt32LE(samples, 40);
      wav.fill(128, 44); // 8-bit silence midpoint
      const exactMs = Math.round((samples * 1000) / sampleRate);
      return Promise.resolve({
        wav,
        durationMs: exactMs,
        words: estimateCaptionWords(text, exactMs),
        alignment: "estimated",
        model: "fake-tts.v1",
        voice,
      });
    },
  };
}

/** The content address: same text × voice × model, same key — everywhere. */
export function narrationCacheKey(model: string, voice: string, text: string): string {
  return sha256Hex(stableStringify({ model, text, voice }));
}

const narrationCacheMetaSchema = z.object({
  model: z.string(),
  voice: z.string(),
  text: z.string(),
  durationMs: z.number().int().positive(),
  alignment: z.enum(["whisper", "estimated"]),
  words: z.array(z.object({ text: z.string(), startMs: z.number().int(), endMs: z.number().int() })),
});

/**
 * Content-addressed artifact cache around any driver: `<dir>/<key>/speech.wav`
 * + `<dir>/<key>/narration.json` (the commit marker, written last). A cache
 * hit never invokes the inner driver — which is also the transport trick the
 * demo CLI leans on: the duration pass warms the cache, the render pass
 * replays it for free.
 */
export function withNarrationCache(driver: NarrationDriver, dir: string): NarrationDriver {
  return {
    name: `${driver.name}+cache`,
    model: driver.model,
    async synthesize(request): Promise<NarrationArtifact> {
      const key = narrationCacheKey(driver.model, request.voice, request.text);
      const entryDir = path.join(dir, key);
      const wavPath = path.join(entryDir, "speech.wav");
      const metaPath = path.join(entryDir, "narration.json");

      let metaRaw: string | null = null;
      try {
        metaRaw = await readFile(metaPath, "utf8");
      } catch {
        metaRaw = null; // no commit marker — miss
      }
      if (metaRaw !== null) {
        const meta = narrationCacheMetaSchema.parse(JSON.parse(metaRaw));
        const wav = await readFile(wavPath); // marker without audio = corrupt entry; loud
        return {
          wav,
          durationMs: meta.durationMs,
          words: meta.words,
          alignment: meta.alignment,
          model: meta.model,
          voice: meta.voice,
        };
      }

      const artifact = await driver.synthesize(request);
      await mkdir(entryDir, { recursive: true });
      await writeFile(wavPath, artifact.wav);
      await writeFile(
        metaPath,
        stableStringify({
          model: artifact.model,
          voice: artifact.voice,
          text: request.text,
          durationMs: artifact.durationMs,
          alignment: artifact.alignment,
          words: artifact.words,
        }),
      );
      return artifact;
    },
  };
}
