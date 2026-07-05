// preinstall ratchet: refuse `npm install` inside a git WORKTREE.
//
// Why: lane worktrees share the main checkout's node_modules via junctions
// (scripts/worktree-setup.ps1). npm v7+ deletes a linked node_modules and
// replaces it with a real folder during install — one accidental
// `npm install` inside a lane silently forks its dependency tree from main.
// Installs belong to the MAIN checkout only; every lane sees them instantly
// through the junction.
//
// Detection: in a worktree, `.git` is a FILE (gitdir pointer); in the main
// checkout (and CI clones) it is a directory. No git invocation needed.
import { statSync } from "node:fs";
import { join } from "node:path";

const dotGit = join(process.cwd(), ".git");
let isWorktree = false;
try {
  isWorktree = statSync(dotGit).isFile();
} catch {
  // No .git at cwd (e.g. npm ci in a bare context) — nothing to guard.
}

if (isWorktree) {
  console.error(
    [
      "",
      "BLOCKED: `npm install` inside a git worktree.",
      "This worktree shares the main checkout's node_modules via a junction;",
      "npm install here would DELETE the junction and fork the dependency tree.",
      "Run the install from the main checkout instead — the junction makes it",
      "visible to every lane. (scripts/worktree-setup.ps1 repairs a broken link.)",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
