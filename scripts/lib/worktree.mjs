import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Is `root` a git WORKTREE rather than the main checkout?
 *
 * In a worktree, `.git` is a FILE holding a `gitdir:` pointer; in the main
 * checkout it is a directory. That difference is the whole test, and it is
 * the cheapest reliable signal available without shelling out to git.
 *
 * Extracted from shoot-surface.mjs so the refusal it drives can be pinned by
 * a test (s78) — a guard nothing exercises is one deletion away from gone.
 */
export function isWorktreeRoot(root) {
  const dotGit = join(root, ".git");
  return existsSync(dotGit) && statSync(dotGit).isFile();
}

/** The single line every worktree refusal opens with — what tests match on. */
export const WORKTREE_REFUSAL_LEAD = "REFUSING: this is a git WORKTREE";

/**
 * Why a lane may not shoot its own work, and what it owes instead.
 *
 * The dev server the screenshot script points at is served from the MAIN
 * checkout, so a lane running it captures code that is not its own and reads
 * the result as its branch passing — a FALSE PASS ON A GATE, which is worse
 * than having no gate at all. A lane cannot start its own dev server either:
 * `next dev` refuses inside a worktree here because Turbopack rejects the
 * out-of-root node_modules symlinks the lanes are prepped with
 * (`agent_handoff/WRAP-videos-rebuild.md:207`).
 *
 * So the screenshot-vs-sheet gate belongs to the LEAD, at merge time, on
 * merged main — which is how every wave has actually run it.
 */
export function worktreeRefusalMessage(baseUrl) {
  return [
    `${WORKTREE_REFUSAL_LEAD}, and ${baseUrl} is served from the main checkout.`,
    "",
    "Shooting it would capture main's code and report it as YOUR branch passing —",
    "a false pass on a gate. `next dev` cannot run in a lane either (Turbopack",
    "rejects the out-of-root node_modules symlinks).",
    "",
    "The screenshot-vs-sheet gate is the LEAD's, run at merge time on merged main.",
    "In your wrap, list the visual deltas you expect per surface so the gate knows",
    "what to look for — that is what you owe here.",
    "",
    "Override only with a dev server that genuinely serves THIS worktree:",
    "  --base http://localhost:<your-port> --i-am-the-lead",
  ].join("\n");
}
