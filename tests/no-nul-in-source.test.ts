import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * A TRACKED SOURCE FILE MUST NOT CONTAIN A NUL BYTE (s79) — because git decides
 * "binary" by scanning for one, and a binary file merges with NO REVIEWABLE DIFF.
 *
 * Second occurrence on record, which is what makes it a class worth a guard:
 *
 *  - s72: a NUL escaped into the S3 object-store lane and needed a lead fix.
 *  - s79: `new File([" "], "clip.mp4")` in a transcription test carried 0x00
 *    where the space should have been, so git filed the whole 12KB test file as
 *    `Bin 0 -> 12667 bytes`. It merged that way. Every future change to it would
 *    have been invisible in review, in a file whose entire job is to be read.
 *    Lane 3 caught it only by running `git show --stat` on its own commit and
 *    not assuming a `.tsx` file is text.
 *
 * Both instances came from a hand-built fixture string, which is exactly where a
 * stray control byte is least visible and least likely to break a test — the
 * suite passed both times. Nothing else would have caught this: not lint, not
 * typecheck, not vitest, and not a human reading the diff, since there was none.
 *
 *  - s88: the THIRD occurrence, and the first DELIBERATE one — a new sibling
 *    ratchet (`repo-hygiene.test.ts`, same s87 commit `e7a46a8`) used a raw NUL
 *    as a join separator, which is a legitimate idea expressed the one way this
 *    guard forbids. So the two ratchets landed in ONE commit contradicting each
 *    other, and `main` sat RED from s87's last commits until the s88
 *    `create-shells` lane hit it and proved it inherited by stashing its own
 *    work and re-running on a clean tree. **The separator was never the problem;
 *    the raw byte was.** `"\0"` (backslash-zero, TWO characters in the file) is
 *    the identical runtime string with no 0x00 on disk — this very file uses it
 *    at `git ls-files -z` above. That is why the failure message below names the
 *    fix: a guard that only says "you are wrong" invites the fix that guts the
 *    guard (deleting the separator, or allowlisting the file).
 *
 * The standing lesson for the LEAD, not the guard: two ratchets can contradict
 * each other, and only a FULL `npm run verify` catches it. s87 added both and
 * did not re-run the suite after its final commits.
 *
 * The extension list is a denylist of genuine binaries rather than an allowlist
 * of text, so a NEW text extension is covered the day it appears instead of
 * silently escaping the guard.
 */
const BINARY_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".avif",
  ".mp4", ".mov", ".webm", ".mp3", ".wav", ".m4a",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".pdf", ".zip", ".gz", ".tgz", ".glb", ".gltf", ".bin", ".wasm",
]);

describe("tracked source carries no NUL bytes", () => {
  it("keeps every text file readable as text, so its diff stays reviewable", () => {
    const files = execFileSync("git", ["ls-files", "-z"], { cwd: REPO, encoding: "utf8" })
      .split("\0")
      .filter(Boolean);
    // Sanity: a guard that scans nothing passes forever.
    expect(files.length).toBeGreaterThan(100);

    const offenders: string[] = [];
    for (const file of files) {
      if (BINARY_EXT.has(path.extname(file).toLowerCase())) continue;
      let buf: Buffer;
      try {
        buf = readFileSync(path.join(REPO, file));
      } catch {
        continue; // a submodule or a path git knows and the fs does not
      }
      const at = buf.indexOf(0);
      if (at !== -1) {
        const near = JSON.stringify(buf.subarray(Math.max(0, at - 40), at + 10).toString("utf8"));
        offenders.push(`${file}: NUL at byte ${at}, near ${near}`);
      }
    }
    expect(
      offenders,
      'NUL byte in tracked source — git will file the whole file as binary and its ' +
        'diff becomes unreviewable. If you MEANT a NUL (a join separator is a fair ' +
        'use), write it as the two-character escape "\\0" instead of embedding 0x00: ' +
        'identical runtime string, nothing binary on disk. Do NOT fix this by dropping ' +
        'the separator or allowlisting the file.',
    ).toEqual([]);
  });
});
