import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { probeSourceDims, SourceProbeError } from "../probe";

/**
 * B-ve.5: probeSourceDims against a FAKE ffprobe that journals its argv and
 * answers canned JSON — pins the invocation, the dedup, and the refusal
 * shapes without touching real media (the dogfood run measures the real
 * thing).
 */

const scratches: string[] = [];
afterAll(() => {
  for (const dir of scratches) rmSync(dir, { recursive: true, force: true });
});

function fakeFfprobe(opts: { stdout?: string; exitCode?: number; stderr?: string }): {
  bin: string;
  journal: () => string[];
} {
  const dir = mkdtempSync(join(tmpdir(), "edl-probe-"));
  scratches.push(dir);
  const bin = join(dir, "ffprobe");
  writeFileSync(
    bin,
    [
      "#!/bin/bash",
      `echo "$*" >> "${join(dir, "journal.log")}"`,
      ...(opts.stderr ? [`echo "${opts.stderr}" >&2`] : []),
      ...(opts.stdout ? [`echo '${opts.stdout}'`] : []),
      `exit ${opts.exitCode ?? 0}`,
    ].join("\n"),
  );
  chmodSync(bin, 0o755);
  return {
    bin,
    journal: () => readFileSync(join(dir, "journal.log"), "utf8").trim().split("\n"),
  };
}

const resolve = (ref: string) => `/media/${ref}`;

describe("probeSourceDims", () => {
  it("measures each DISTINCT ref once via ffprobe's video stream entries", async () => {
    const fake = fakeFfprobe({ stdout: '{"streams":[{"width":1280,"height":720}]}' });
    const dims = await probeSourceDims(
      ["motion/keepers/b1.mp4", "motion/keepers/b2.mp4", "motion/keepers/b1.mp4"],
      { resolve, ffprobe: fake.bin },
    );
    expect(dims).toEqual({
      "motion/keepers/b1.mp4": { width: 1280, height: 720 },
      "motion/keepers/b2.mp4": { width: 1280, height: 720 },
    });
    const calls = fake.journal();
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("-select_streams v:0");
    expect(calls[0]).toContain("/media/motion/keepers/b1.mp4");
  });

  it("carries ffprobe's own stderr in the refusal — the operator reads the real error", async () => {
    const fake = fakeFfprobe({ exitCode: 1, stderr: "No such file or directory" });
    await expect(
      probeSourceDims(["motion/missing.mp4"], { resolve, ffprobe: fake.bin }),
    ).rejects.toThrow(/motion\/missing\.mp4: No such file or directory/);
  });

  it("refuses media without a measurable video stream (an audio take on the beat lane)", async () => {
    const fake = fakeFfprobe({ stdout: '{"streams":[]}' });
    await expect(
      probeSourceDims(["music/track.mp3"], { resolve, ffprobe: fake.bin }),
    ).rejects.toBeInstanceOf(SourceProbeError);
  });
});
