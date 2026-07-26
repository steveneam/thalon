import { readdirSync } from "node:fs";
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

  it("still keeps the lane record reachable, rather than deleting the history", () => {
    const lanes = readdirSync(path.join(HANDOFF, "lanes"));
    expect(lanes.length).toBeGreaterThan(0);
    expect(lanes.every((f) => /^(KICKOFF|WRAP)-.*\.md$/.test(f))).toBe(true);
  });
});
