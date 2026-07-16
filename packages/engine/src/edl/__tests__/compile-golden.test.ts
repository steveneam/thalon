import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileEdl } from "../compile";
import { film16x9V6 } from "./fixtures/film-16x9-v6";
import { film9x16Master } from "./fixtures/film-9x16-master";
import { musicCue } from "./fixtures/music-cue";

/**
 * B-ve.1 golden ratchet (ADR 0010): the two concept-film EDL fixtures —
 * the hand recipes made data — compile to PINNED plans, forever, in CI.
 * Stream-level equivalence with the shipped masters is proven separately
 * by the gated replay test (film-replay.test.ts, THALON_FILM_REPLAY=1).
 *
 * To regenerate after a DELIBERATE compiler change:
 *   UPDATE_EDL_GOLDENS=1 npm test -w @thalon/engine -- compile-golden
 * then review the golden diff like any contract change.
 */

const CASES = [
  { name: "film-16x9-v6", edl: film16x9V6 },
  { name: "film-9x16-master", edl: film9x16Master },
  { name: "music-cue", edl: musicCue },
] as const;

const goldenPath = (name: string) => join(__dirname, "fixtures", `${name}.plan.json`);

describe("EDL compiler goldens", () => {
  for (const { name, edl } of CASES) {
    it(`compiles ${name} to its pinned plan`, () => {
      const plan = `${JSON.stringify(compileEdl(edl), null, 2)}\n`;
      if (process.env.UPDATE_EDL_GOLDENS === "1") {
        writeFileSync(goldenPath(name), plan);
        return;
      }
      expect(plan).toBe(readFileSync(goldenPath(name), "utf8"));
    });
  }

  it("pins the load-bearing 9:16 machinery inside the plan", () => {
    const plan = compileEdl(film9x16Master);
    // The b9 full-width sweep survives verbatim (quoted by the compiler).
    expect(plan.filter).toContain("crop=405:720:x='min(875*t/4.5,875)':y='0'");
    // Derived xfade offsets carry no float dust (the recipes' round(x, 6)).
    expect(plan.filter).toContain("offset=4.641667[");
    expect(plan.filter).toContain("offset=37.133336[");
    // The endcard freeze: trim at `at`, clone-hold to the output duration.
    expect(plan.filter).toContain("trim=0:41.375,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=9.4[frozen]");
    // The score is stream-copied from input 19 (9 beats + 9 plates + endcard).
    expect(plan.maps).toEqual(["[vout]", "19:a"]);
    expect(plan.audioArgs).toEqual(["-c:a", "copy"]);
  });

  it("compiler caps fail loud, never silently truncate", () => {
    expect(() =>
      compileEdl({
        ...film16x9V6,
        audio: [
          { source: { kind: "audio", ref: "a.m4a" } },
          { source: { kind: "audio", ref: "b.m4a" } },
        ],
      }),
    ).toThrow(/at most one audio cue/);
    expect(() =>
      compileEdl({
        ...film9x16Master,
        video: (film9x16Master.video ?? []).map((clip, i) =>
          i === 1 ? { ...clip, transitionIn: undefined } : clip,
        ),
      }),
    ).toThrow(/must declare an xfade transition/);
  });
});
