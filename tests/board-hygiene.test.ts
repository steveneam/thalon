import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Board/tracked-file hygiene ratchets (2026-07-07, wave-2 merge-train
 * lesson). Two real failures made these executable:
 *  1. A conflict resolution was committed WITH the merge markers still in
 *     COORDINATION.md — nothing in CI would have refused it (the guard greps
 *     brand tokens, lint ignores markdown). Markers in a tracked file are
 *     never intentional; refuse them repo-wide.
 *  2. COORDINATION.md once lost its trailing newline, so the next lane's
 *     append-only wrap message concatenated onto the previous message's
 *     line (corrupting the board's one-message-per-line contract and making
 *     every later merge resolve harder). The append-prone files must end
 *     with exactly one newline.
 */

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** The same universe the CI grep guard uses: git-tracked files only. */
function trackedFiles(): string[] {
  return execSync("git ls-files", { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 })
    .toString("utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

const BINARY_EXT = /\.(png|jpg|jpeg|gif|webp|ico|mp4|webm|mov|woff2?|ttf|otf|pdf|zip)$/i;
// Built without literal markers so this file can never trip its own scan.
const CONFLICT_MARKER = new RegExp(`^(${"<".repeat(7)}|${">".repeat(7)})( |$)`, "m");

describe("board hygiene", () => {
  it("no tracked file contains merge-conflict markers", () => {
    const files = trackedFiles().filter((f) => !BINARY_EXT.test(f));
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((f) =>
      CONFLICT_MARKER.test(readFileSync(path.join(repoRoot, f), "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("append-prone board files end with exactly one newline", () => {
    for (const file of ["COORDINATION.md", "agent_handoff/CURRENT.md"]) {
      const normalized = readFileSync(path.join(repoRoot, file), "utf8").replace(/\r/g, "");
      expect(normalized.endsWith("\n"), `${file} must end with a newline`).toBe(true);
      expect(normalized.endsWith("\n\n"), `${file} must not end with blank lines`).toBe(false);
    }
  });
});
