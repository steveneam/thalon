import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    // Worktree lanes share one node_modules symlinked to the main checkout
    // (AGENTS.md), so the @thalon/* entries under it point at the main
    // checkout's packages — not this worktree's local edits. Alias sibling
    // workspace packages to this worktree's own sources so engine's tests
    // exercise the platform/db changes actually made in this lane. Safe and
    // portable post-merge too: the relative layout is identical in main.
    alias: {
      "@thalon/contracts": path.resolve(dirname, "../contracts/src/index.ts"),
      "@thalon/db": path.resolve(dirname, "../db/src/index.ts"),
      "@thalon/platform": path.resolve(dirname, "../platform/src/index.ts"),
    },
  },
  test: {
    name: "engine",
    environment: "node",
    // PGlite (via @thalon/db fixtures) is WASM; first boot per test file can be slow on CI.
    testTimeout: 30_000,
  },
});
