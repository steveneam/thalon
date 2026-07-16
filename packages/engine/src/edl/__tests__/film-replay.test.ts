import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { VideoSourceRef } from "@thalon/contracts";
import { compileEdl } from "../compile";
import { buildFfmpegArgs } from "../plan";
import { film16x9Scored } from "./fixtures/film-16x9-scored";
import { film16x9V6 } from "./fixtures/film-16x9-v6";
import { film9x16Master } from "./fixtures/film-9x16-master";

/**
 * B-ve.1 replay ratchet (ADR 0010): the compiler REBUILDS both concept-film
 * masters from the checked-in EDL fixtures, proven at the decoded-stream
 * level — `ffmpeg -f framemd5` over every video frame (and audio frame,
 * 9:16) of the replay vs the master of record on disk. Stream-level, not
 * container-byte-level, on purpose: mp4 container metadata is not the film.
 *
 * Gated OFF by default: it needs the gitignored film project tree
 * (.context/design/film-storyboard-s41), local ffmpeg + ImageMagick +
 * FreeSerif-Italic, and two x264 -preset slow renders (minutes each). CI
 * never has the assets; the compiled-plan goldens (compile-golden.test.ts)
 * are the always-on pin. Run it on the box of record:
 *
 *   THALON_FILM_REPLAY=1 npm test -w @thalon/engine -- film-replay
 *
 * (Documented-command discipline: this is the monthly-pass entry for the
 * EDL compiler.)
 */

const FILM_DIR =
  process.env.THALON_FILM_DIR ??
  join(__dirname, "..", "..", "..", "..", "..", ".context", "design", "film-storyboard-s41");
const FFMPEG = process.env.THALON_FFMPEG ?? join(homedir(), ".local", "bin", "ffmpeg");
const MAGICK = process.env.THALON_MAGICK ?? join(homedir(), ".local", "bin", "magick");

const armed =
  process.env.THALON_FILM_REPLAY === "1" &&
  existsSync(FILM_DIR) &&
  existsSync(FFMPEG) &&
  existsSync(MAGICK);

const CASES = [
  { edl: film16x9V6, target: "cuts/cut-v6-endcard-graded.mp4" },
  { edl: film9x16Master, target: "cuts/thalon-concept-film-9x16-master.mp4" },
  // B-ve.4: the scored master via copy output mode — replays its own
  // EDL-built output (the hand mux's 3-frame-short video is a -t artifact
  // the EDL rightly does not reproduce; the audio bridge is pinned below).
  { edl: film16x9Scored, target: "cuts/concept-film-16x9-scored-v1.mp4" },
] as const;

const scratches: string[] = [];

afterAll(() => {
  for (const dir of scratches) rmSync(dir, { recursive: true, force: true });
});

function framemd5(file: string, map?: string): string {
  return execFileSync(
    FFMPEG,
    ["-v", "error", "-i", file, ...(map ? ["-map", map] : []), "-f", "framemd5", "-"],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );
}

describe.runIf(armed)("film replay (gated: THALON_FILM_REPLAY=1 + film tree on disk)", () => {
  for (const { edl, target } of CASES) {
    it(
      `rebuilds ${target} stream-identically from its EDL fixture`,
      { timeout: 1_800_000 },
      () => {
        const plan = compileEdl(edl);
        const scratch = mkdtempSync(join(tmpdir(), "edl-replay-"));
        scratches.push(scratch);

        // Plates share the _t.png scratch — build them in order, cwd-scoped.
        for (const plate of plan.plates) {
          for (const command of plate.commands) {
            execFileSync(MAGICK, command, { cwd: scratch });
          }
        }

        const resolve = (ref: VideoSourceRef) => join(FILM_DIR, ref.ref);
        const out = join(scratch, "replay.mp4");
        execFileSync(FFMPEG, buildFfmpegArgs(plan, resolve, scratch, out), {
          timeout: 1_700_000,
        });

        expect(framemd5(out)).toBe(framemd5(join(FILM_DIR, target)));
      },
    );
  }

  // The provenance bridge (B-ve.4): the EDL-built scored cut carries the
  // EXACT audio stream of the historical hand mux — same track, same 105.0s
  // offset, same 1.2s entry ease and 1.275s tail ease, same 192k encode —
  // proven at the decoded-frame level. (Its video is v6's stream with all
  // 1219 frames; the hand mux dropped the last 3 to a -t copy artifact.)
  it("scored cut's audio stream framemd5-equals the historical hand mux", () => {
    expect(framemd5(join(FILM_DIR, "cuts/concept-film-16x9-scored-v1.mp4"), "0:a")).toBe(
      framemd5(join(FILM_DIR, "cuts/thalon-concept-film-16x9-master.mp4"), "0:a"),
    );
  });
});

describe.runIf(!armed)("film replay (skipped)", () => {
  it("records why it did not run", () => {
    expect(armed).toBe(false);
  });
});
