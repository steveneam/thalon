import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { isWorktreeRoot, WORKTREE_REFUSAL_LEAD } from "../scripts/lib/worktree.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * A WORKTREE LANE MUST NOT BE ABLE TO SCREENSHOT ITS OWN WORK (s78).
 *
 * The mistake this pins was the lead's own: both s78 lane kickoffs told the
 * lanes to screenshot-gate their changes. That instruction was wrong in the
 * worst direction — `scripts/shoot-surface.mjs` points at the lead's dev
 * server, which serves MAIN, so a lane running it captures code that is not
 * its own and reads the result as its branch passing. A FALSE PASS ON A GATE
 * is worse than no gate. A lane cannot run its own dev server instead either:
 * Turbopack rejects the out-of-root node_modules symlinks lanes are prepped
 * with (`agent_handoff/WRAP-videos-rebuild.md:207`).
 *
 * The first fix was a runtime refusal in the script and nothing else — which
 * is exactly the shape of guard that rots, because nothing exercises it.
 * (`npm run guard` was broken for three buckets before anything ran it.) So
 * the guard is pinned HERE, in the repo-wide suite that `npm test` and CI
 * both run.
 *
 * The wiring test spawns the REAL script inside a fabricated worktree rather
 * than unit-testing the helper alone: deleting the *call* has to fail too,
 * not just deleting the predicate.
 */
describe("shoot-surface refuses to run from a git worktree", () => {
  const temps: string[] = [];

  function tempDir(): string {
    const dir = mkdtempSync(path.join(tmpdir(), "thalon-worktree-guard-"));
    temps.push(dir);
    return dir;
  }

  afterEach(() => {
    while (temps.length > 0) rmSync(temps.pop()!, { recursive: true, force: true });
  });

  /**
   * Every script that reports on the LEAD's dev server, and so must refuse to
   * run from a lane. Both carry the same false-pass hazard: the server they
   * point at serves MAIN, so a lane running either one measures code that is
   * not its own and reads the result as its branch passing.
   */
  const GATED_SCRIPTS = ["scripts/shoot-surface.mjs", "scripts/drive-surface.mjs"];

  /** A fake repo root carrying real copies of the scripts + their libs. */
  function fakeRepo(dotGit: "file" | "dir" | "none"): string {
    const root = tempDir();
    mkdirSync(path.join(root, "scripts", "lib"), { recursive: true });
    for (const s of GATED_SCRIPTS) cpSync(path.join(REPO, s), path.join(root, s));
    for (const lib of ["worktree.mjs", "surface-driver.mjs", "surface-jobs.mjs"]) {
      cpSync(path.join(REPO, "scripts/lib", lib), path.join(root, "scripts/lib", lib));
    }
    if (dotGit === "file") {
      writeFileSync(path.join(root, ".git"), "gitdir: /home/deploy/work/thalon/.git/worktrees/lane\n");
    } else if (dotGit === "dir") {
      mkdirSync(path.join(root, ".git"));
    }
    return root;
  }

  function runScript(root: string, args: string[], script = "scripts/shoot-surface.mjs") {
    return spawnSync(process.execPath, [path.join(root, script), ...args], {
      encoding: "utf8",
    });
  }

  it("knows a worktree from the main checkout by whether .git is a FILE", () => {
    expect(isWorktreeRoot(fakeRepo("file"))).toBe(true);
    expect(isWorktreeRoot(fakeRepo("dir"))).toBe(false);
    expect(isWorktreeRoot(fakeRepo("none"))).toBe(false);
  });

  /**
   * THE REAL CHECKOUTS — RESOLVED, NOT ASSUMED (s79).
   *
   * This assertion shipped as `expect(isWorktreeRoot(REPO)).toBe(false)`, i.e.
   * "the suite running this is the main checkout". True on main and FALSE IN
   * EVERY LANE — so the ratchet built at s78 to protect lanes went red *inside*
   * them, and both s79 lanes would have opened on a red verify pointing at this
   * line. The obvious way to make it green is to delete it, which is exactly
   * how a guard rots: the s78 lesson was that a guard scoped to the place you
   * already cleaned is not a guard, and this is the same mistake wearing the
   * opposite face.
   *
   * `--git-common-dir` names the MAIN checkout's .git from any worktree, so the
   * negative case now runs against a real main checkout wherever this suite
   * runs. And where the suite IS a lane, the difference becomes extra coverage
   * rather than a failure: assert the positive against a real worktree too.
   */
  it("agrees with git about real checkouts, wherever this suite runs", () => {
    const commonDir = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd: REPO, encoding: "utf8" },
    ).trim();
    const mainCheckout = path.dirname(commonDir);
    expect(isWorktreeRoot(mainCheckout)).toBe(false);
    if (path.resolve(REPO) !== path.resolve(mainCheckout)) {
      expect(isWorktreeRoot(REPO)).toBe(true);
    }
  });

  it("REFUSES with a non-zero exit when run from a worktree, before touching a browser", () => {
    const result = runScript(fakeRepo("file"), ["--route", "/app/runs"]);
    expect(result.status).toBe(2);
    // The message, not just the exit code: a copy of this script placed in a
    // temp dir would exit non-zero for several uninteresting reasons, and a
    // bare status check would pass on any of them.
    expect(result.stderr).toContain(WORKTREE_REFUSAL_LEAD);
    expect(result.stderr).toContain("false pass on a gate");
    expect(result.stderr).toContain("the LEAD's, run at merge time on merged main");
    // It must refuse BEFORE doing any real work — no shots, no browser.
    expect(result.stdout).not.toContain("shot(s)");
  });

  it("names the deliberate override rather than leaving a lane stuck", () => {
    const result = runScript(fakeRepo("file"), ["--route", "/app/runs"]);
    expect(result.stderr).toContain("--i-am-the-lead");
  });

  it("does NOT refuse in the main checkout — the lead's own gate still runs", () => {
    // No .git file: the guard must fall through. It then fails on the usual
    // usage path, which is proof it got past the refusal.
    const result = runScript(fakeRepo("dir"), []);
    expect(result.stderr).not.toContain(WORKTREE_REFUSAL_LEAD);
    expect(result.stderr).toContain("usage: node scripts/shoot-surface.mjs");
  });

  it("keeps the refusal WIRED — the real script must still call the guard", () => {
    // Guards rot by having their call site deleted while the helper survives,
    // which a unit test of the helper alone would never catch. Pin both the
    // import and the call in the shipped script.
    const src = spawnSync("cat", [path.join(REPO, "scripts/shoot-surface.mjs")], {
      encoding: "utf8",
    }).stdout;
    expect(src).toContain("isWorktreeRoot");
    expect(src).toMatch(/refuseInsideWorktree\(\s*base\s*,/);
  });

  /**
   * THE INTERACTION DRIVER IS GATED THE SAME WAY (s79).
   *
   * `drive-surface.mjs` answers "can an operator do the job?" against the dev
   * server — which is the LEAD's, serving MAIN. A lane driving it would exercise
   * main's code and read the resulting jobs table as its own branch passing:
   * the identical false pass the screenshot gate refuses, and a worse one,
   * because a jobs table reads as proof the surface WORKS.
   *
   * Pinned as its own case rather than folded into the loop above so the failure
   * message names the driver when someone deletes its refusal.
   */
  it("REFUSES to drive a surface from a worktree too — a jobs table reads as proof", () => {
    const result = runScript(fakeRepo("file"), ["--jobs", "dashboard"], "scripts/drive-surface.mjs");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(WORKTREE_REFUSAL_LEAD);
    expect(result.stderr).toContain("false pass on a gate");
    // Refused before any browser or job ran — no table, not even an empty one.
    expect(result.stdout).not.toContain("JOBS");

    const src = spawnSync("cat", [path.join(REPO, "scripts/drive-surface.mjs")], {
      encoding: "utf8",
    }).stdout;
    expect(src).toContain("isWorktreeRoot");
    expect(src).toContain("worktreeRefusalMessage");
  });

  /**
   * A harness error must never be reported as a passing job. The driver counts
   * them separately and exits non-zero, because the s79 baseline run proved the
   * hazard is real: four of its own selectors were wrong, two of which produced
   * PASSES on surfaces that genuinely carry the defect.
   */
  it("keeps the driver's harness-error path distinct from a product verdict", () => {
    const src = spawnSync("cat", [path.join(REPO, "scripts/drive-surface.mjs")], {
      encoding: "utf8",
    }).stdout;
    expect(src).toMatch(/verdict\s*=\s*err && err\.verdict \? err\.verdict : "error"/);
    expect(src).toContain("failed inside the HARNESS, not the product");
    expect(src).toMatch(/process\.exit\(1\)/);
  });
});
