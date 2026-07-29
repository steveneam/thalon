import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HANDOFF = path.join(REPO, "agent_handoff");

/**
 * Is `ref` the wrap that `doc` — a kickoff — will itself produce?
 *
 * A lane's kickoff ends by naming its own wrap file; that wrap does not exist
 * until the lane finishes, so the link is legitimately forward-looking. Every
 * other missing lane-paperwork link is a rotted reference.
 */
function isOwnWrapForwardRef(doc: string, ref: string): boolean {
  if (path.dirname(doc) !== "agent_handoff/lanes") return false;
  const kickoff = /^KICKOFF-(.+)\.md$/.exec(path.basename(doc));
  const wrap = /^WRAP-(.+)\.md$/.exec(path.basename(ref));
  return kickoff !== null && wrap !== null && kickoff[1] === wrap[1];
}

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
   *
   * ONE exemption, and it has to stay narrow: a kickoff names the wrap IT WILL
   * WRITE. That is a forward reference, not a rotted link — the wrap does not
   * exist until the lane finishes. Learned immediately and the hard way:
   * `ecee263` shipped the two s79 kickoffs and turned this guard RED on main,
   * because each one ends "write agent_handoff/lanes/WRAP-s79-laneN.md".
   */
  it("every lane-paperwork link in tracked markdown resolves to a real file", () => {
    const broken: string[] = [];
    const docs = execSync('git ls-files "*.md"', { cwd: REPO, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
    for (const doc of docs) {
      const body = readFileSync(path.join(REPO, doc), "utf8");
      for (const [, ref] of body.matchAll(/(agent_handoff\/lanes\/[A-Za-z0-9._-]+\.md)/g)) {
        if (existsSync(path.join(REPO, ref))) continue;
        if (isOwnWrapForwardRef(doc, ref)) continue;
        broken.push(`${doc} → ${ref}`);
      }
    }
    expect(broken).toEqual([]);
  });

  /**
   * The exemption is SAME-SLUG ONLY, pinned because widening it to "kickoffs
   * are exempt" would silently un-guard the cross-lane citations that are the
   * most likely to rot: s79's kickoffs both cite `WRAP-s78-lane1.md`, and
   * `KICKOFF-intel-rebuild.md` cites `WRAP-blearn.md`.
   */
  it("exempts a kickoff's own future wrap, and nothing else", () => {
    const lanes = "agent_handoff/lanes";
    // Its own wrap, by slug: exempt.
    expect(isOwnWrapForwardRef(`${lanes}/KICKOFF-s79-lane3.md`, `${lanes}/WRAP-s79-lane3.md`)).toBe(true);
    // Another lane's wrap: a real citation, still checked.
    expect(isOwnWrapForwardRef(`${lanes}/KICKOFF-s79-lane3.md`, `${lanes}/WRAP-s78-lane1.md`)).toBe(false);
    expect(isOwnWrapForwardRef(`${lanes}/KICKOFF-intel-rebuild.md`, `${lanes}/WRAP-blearn.md`)).toBe(false);
    // A near-miss slug is a different lane, not a typo to forgive.
    expect(isOwnWrapForwardRef(`${lanes}/KICKOFF-s79-lane3.md`, `${lanes}/WRAP-s79-lane30.md`)).toBe(false);
    // Only a kickoff gets it, and only from lanes/ — a wrap or a standing doc
    // citing a missing wrap is exactly the dead link this suite exists for.
    expect(isOwnWrapForwardRef(`${lanes}/WRAP-s79-lane3.md`, `${lanes}/WRAP-s79-lane3.md`)).toBe(false);
    expect(isOwnWrapForwardRef("agent_handoff/CURRENT.md", `${lanes}/WRAP-s79-lane3.md`)).toBe(false);
    expect(isOwnWrapForwardRef("docs/KICKOFF-s79-lane3.md", `${lanes}/WRAP-s79-lane3.md`)).toBe(false);
  });

  it("still keeps the lane record reachable, rather than deleting the history", () => {
    const lanes = readdirSync(path.join(HANDOFF, "lanes"));
    expect(lanes.length).toBeGreaterThan(0);
    expect(lanes.every((f) => /^(KICKOFF|WRAP)-.*\.md$/.test(f))).toBe(true);
  });

  /**
   * A DONE ITEM ON A BOARD OF OPEN ACTIONS IS A FALSE CLAIM (founder, 2026-07-29).
   *
   * NEEDS-STEVEN feeds his dashboard card, so every line on it reads as a
   * decision he still owes. It had drifted to 46 lines of which 18 were already
   * resolved — he noticed before we did ("it is building up with stale
   * notifications"), and swordfish's read-only hygiene check found the count.
   * The header rule ("a resolved item moves to archive/ in the SAME wrap") is
   * documentary and would rot exactly the way the board did; this is the
   * executable half, and it runs on every verify.
   *
   * Scoped deliberately to the ✅/~~strikethrough~~ markers we use to mean
   * "closed". Prose that merely mentions a resolution is not matched — the test
   * should catch the habit of ticking an item in place, not police wording.
   */
  it("keeps only OPEN actions on the founder's board — resolved ones move to archive/", () => {
    const board = readFileSync(path.join(HANDOFF, "NEEDS-STEVEN.md"), "utf8")
      .split("\n")
      .filter((l) => l.startsWith("- ["));
    const resolved = board.filter((l) => /✅|~~/.test(l));
    expect(resolved).toEqual([]);
    // The archive must actually exist once anything has closed, so the rule is
    // "move it", never "delete it" — the reasoning outlives the action.
    expect(existsSync(path.join(HANDOFF, "archive", "NEEDS-STEVEN-closed.md"))).toBe(true);
  });
});
