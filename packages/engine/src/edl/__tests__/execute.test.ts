import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { EdlInput, VideoSourceRef } from "@thalon/contracts";
import { compileEdl } from "../compile";
import { EdlExecuteError, executePlan } from "../execute";

/**
 * B-ve.3: executePlan is the replay recipe as a function — plates in order
 * (cwd-scoped: they share `_t.png`), then one ffmpeg invocation. Proven here
 * against FAKE binaries that journal their argv + cwd, so the test pins the
 * orchestration without rendering anything; stream-level truth stays with
 * the gated film replay (film-replay.test.ts).
 */

const scratches: string[] = [];
afterAll(() => {
  for (const dir of scratches) rmSync(dir, { recursive: true, force: true });
});

function scratchDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "edl-execute-"));
  scratches.push(dir);
  return dir;
}

/** A fake binary that appends `<label> <cwd> <argv…>` per call to journal.log. */
function fakeBinary(dir: string, name: string, opts?: { exitCode?: number; stderr?: string }): string {
  const file = join(dir, name);
  const lines = [
    "#!/bin/bash",
    `echo "${name} $PWD $*" >> "${join(dir, "journal.log")}"`,
    ...(opts?.stderr ? [`echo "${opts.stderr}" >&2`] : []),
    `exit ${opts?.exitCode ?? 0}`,
  ];
  writeFileSync(file, lines.join("\n"));
  chmodSync(file, 0o755);
  return file;
}

function journal(dir: string): string[] {
  return readFileSync(join(dir, "journal.log"), "utf8").trim().split("\n");
}

/** Two beats + one caption line + encoded music — exercises plates, filtergraph, and audio. */
const EDL: EdlInput = {
  name: "test-cut",
  output: { width: 1280, height: 720, fps: 24, duration: 9.5 },
  video: [
    { name: "b1", source: { kind: "take", ref: "motion/keepers/beat-01.mp4" }, duration: 5 },
    {
      name: "b2",
      source: { kind: "take", ref: "motion/keepers/beat-02.mp4" },
      duration: 5,
      transitionIn: { type: "xfade", duration: 0.5 },
    },
  ],
  audio: [{ source: { kind: "audio", ref: "music/track.mp3" }, offset: 3, gainDb: -2 }],
  captions: {
    style: { pointsize: 44 },
    lines: [{ text: "measured, not vibed", x: 640, y: 600, fadeIn: 1, fadeOut: 4 }],
  },
};

/** The same lane without the caption pass (no plates → magick never runs). */
const { captions: _captions, ...EDL_NO_CAPTIONS } = EDL;

const resolve = (ref: VideoSourceRef) => `/media/${ref.ref}`;

describe("executePlan", () => {
  it("builds plates in order (cwd = plateDir) then runs ffmpeg with the plan argv", async () => {
    const bin = scratchDir();
    const plates = join(scratchDir(), "plates");
    mkdirSync(plates, { recursive: true });
    const plan = compileEdl(EDL);
    expect(plan.plates.length).toBe(1);

    const result = await executePlan(plan, {
      resolve,
      output: "/media/cuts/test-cut-v2.mp4",
      plateDir: plates,
      ffmpeg: fakeBinary(bin, "ffmpeg"),
      magick: fakeBinary(bin, "magick"),
    });

    const calls = journal(bin);
    // One journal line per magick argv list (2 per plate: text, then glow/flatten), ffmpeg last.
    expect(calls.length).toBe(3);
    expect(calls[0]).toMatch(new RegExp(`^magick ${plates} `));
    expect(calls[1]).toMatch(new RegExp(`^magick ${plates} .*c1\\.png$`));
    expect(calls[2].startsWith("ffmpeg ")).toBe(true);
    expect(calls[2]).toContain("/media/motion/keepers/beat-01.mp4");
    expect(calls[2]).toContain(`${plates}/c1.png`);
    expect(calls[2]).toContain("/media/cuts/test-cut-v2.mp4");
    expect(result.platesBuilt).toBe(1);
    expect(result.ffmpegArgs.at(-1)).toBe("/media/cuts/test-cut-v2.mp4");
  });

  it("surfaces a plate failure verbatim (stage + stderr), never reaching ffmpeg", async () => {
    const bin = scratchDir();
    const plates = scratchDir();
    const plan = compileEdl(EDL);
    await expect(
      executePlan(plan, {
        resolve,
        output: "/tmp/out.mp4",
        plateDir: plates,
        ffmpeg: fakeBinary(bin, "ffmpeg"),
        magick: fakeBinary(bin, "magick", { exitCode: 2, stderr: "unable to read font" }),
      }),
    ).rejects.toThrowError(/plate step failed.*unable to read font/s);
    expect(() => journal(bin)).not.toThrow(); // magick journaled…
    expect(journal(bin).some((l) => l.startsWith("ffmpeg"))).toBe(false); // …ffmpeg never ran
  });

  it("surfaces an ffmpeg failure as EdlExecuteError with the stderr", async () => {
    const bin = scratchDir();
    const plan = compileEdl(EDL_NO_CAPTIONS);
    const attempt = executePlan(plan, {
      resolve,
      output: "/tmp/out.mp4",
      plateDir: scratchDir(),
      ffmpeg: fakeBinary(bin, "ffmpeg", { exitCode: 1, stderr: "Invalid data found" }),
      magick: fakeBinary(bin, "magick"),
    });
    await expect(attempt).rejects.toBeInstanceOf(EdlExecuteError);
    await expect(attempt).rejects.toThrowError(/ffmpeg step failed.*Invalid data found/s);
  });

  it("a plateless plan skips magick entirely", async () => {
    const bin = scratchDir();
    const plan = compileEdl(EDL_NO_CAPTIONS);
    await executePlan(plan, {
      resolve,
      output: "/tmp/out.mp4",
      plateDir: scratchDir(),
      ffmpeg: fakeBinary(bin, "ffmpeg"),
      magick: fakeBinary(bin, "magick"),
    });
    expect(journal(bin)).toHaveLength(1);
    expect(journal(bin)[0].startsWith("ffmpeg")).toBe(true);
  });
});
