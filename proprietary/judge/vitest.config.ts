import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Worktrees resolve @thalon/* through node_modules symlinks that MAY point
// at a different checkout of the monorepo than this one. Alias explicitly to
// THIS worktree's own package sources so a package edit under test (e.g. the
// I1 check in packages/db/src/repos/drafts.ts) is always the copy exercised,
// never a stale sibling checkout.
const pkg = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  test: {
    name: "judge",
    environment: "node",
    // Pipeline tests spin up a PGlite (WASM) fixture via @thalon/db.
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@thalon/contracts": pkg("../../packages/contracts/src/index.ts"),
      "@thalon/db": pkg("../../packages/db/src/index.ts"),
      "@thalon/platform": pkg("../../packages/platform/src/index.ts"),
    },
  },
});
