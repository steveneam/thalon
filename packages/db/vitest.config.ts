import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    // Worktree lanes share one node_modules junctioned to the main checkout,
    // so the @thalon/* entries under it point at the MAIN checkout's packages
    // — not this worktree's local edits. Alias sibling workspace packages to
    // this worktree's own sources (packages/engine's vitest.config.ts is the
    // reference pattern this mirrors).
    alias: {
      "@thalon/contracts": path.resolve(dirname, "../contracts/src/index.ts"),
      "@thalon/platform": path.resolve(dirname, "../platform/src/index.ts"),
    },
  },
  test: {
    name: "db",
    environment: "node",
    // PGlite is WASM; first boot per test file can be slow on CI.
    testTimeout: 30_000,
  },
});
