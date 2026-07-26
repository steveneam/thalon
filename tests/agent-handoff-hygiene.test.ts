import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HANDOFF = path.join(REPO, "agent_handoff");

/**
 * agent_handoff/ IS A DESK, NOT AN ATTIC (founder, s78).
 *
 * Its top level had reached 49 files, 43 of them dead lane paperwork going
 * back to s65 — `WRAP-pub2-drivers.md` still sitting beside `CURRENT.md` a
 * dozen sessions after its lane merged. His words: "where's your sense of repo
 * hygiene? how you expect to write good code and build proper products with
 * this mess of a repo".
 *
 * The convention (top level = standing files, lanes/ = per-lane paperwork) is
 * written in agent_handoff/README.md. This is the part that RUNS, because the
 * mess did not appear in one session — it accreted one wrap at a time while a
 * documented rule would have watched it happen (AGENTS.md rule 8).
 */
describe("agent_handoff hygiene", () => {
  const top = readdirSync(HANDOFF, { withFileTypes: true });
  const files = top.filter((e) => e.isFile()).map((e) => e.name);

  it("keeps no lane paperwork at the top level — it belongs in lanes/", () => {
    const stray = files.filter((f) => /^(KICKOFF|WRAP)-/.test(f));
    expect(stray).toEqual([]);
  });

  it("holds only the standing files, so the live ones are findable", () => {
    const STANDING = new Set([
      "README.md",
      "CURRENT.md",
      "NEEDS-STEVEN.md",
      "ROADMAP.md",
      "ASK-BACKS-FOR-SWORDFISH.md",
      "FROM-SWORDFISH.md",
      "SWORDFISH-ARCHIVE.md",
    ]);
    // A new standing file is a deliberate act: add it HERE and say why in the
    // README. Anything else is ephemera that wants a home somewhere else.
    expect(files.filter((f) => !STANDING.has(f))).toEqual([]);
  });

  /**
   * THE RATCHET ONLY LOOKED WHERE I HAD ALREADY CLEANED (founder, s78).
   *
   * `WRAP-pub2-drivers.md` — the file he named BY HAND — was never in
   * agent_handoff at all. It had sat at the REPO ROOT since s65, so the
   * cleanup glob never saw it and this suite passed while it stayed put. A
   * guard scoped to the tidy drawer is not a guard.
   */
  it("keeps lane paperwork out of the REPO ROOT too — the one that was actually missed", () => {
    const strays = readdirSync(REPO, { withFileTypes: true })
      .filter((e) => e.isFile() && /^(KICKOFF|WRAP)-/.test(e.name))
      .map((e) => e.name);
    expect(strays).toEqual([]);
  });

  /**
   * And the second-order failure: a bulk path rewrite pointed four references
   * at `agent_handoff/lanes/WRAP-pub2-drivers.md` while the file was still at
   * the root — turning one misfiled file into four dead links. Cheaper to
   * check every link than to remember.
   */
  it("every lane-paperwork link in tracked markdown resolves to a real file", () => {
    const broken: string[] = [];
    const docs = execSync('git ls-files "*.md"', { cwd: REPO, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
    for (const doc of docs) {
      const body = readFileSync(path.join(REPO, doc), "utf8");
      for (const [, ref] of body.matchAll(/(agent_handoff\/lanes\/[A-Za-z0-9._-]+\.md)/g)) {
        if (!existsSync(path.join(REPO, ref))) broken.push(`${doc} → ${ref}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("still keeps the lane record reachable, rather than deleting the history", () => {
    const lanes = readdirSync(path.join(HANDOFF, "lanes"));
    expect(lanes.length).toBeGreaterThan(0);
    expect(lanes.every((f) => /^(KICKOFF|WRAP)-.*\.md$/.test(f))).toBe(true);
  });
});
