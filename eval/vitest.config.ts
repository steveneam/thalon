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
      "@thalon/contracts": path.resolve(dirname, "../packages/contracts/src/index.ts"),
      "@thalon/db": path.resolve(dirname, "../packages/db/src/index.ts"),
      "@thalon/engine": path.resolve(dirname, "../packages/engine/src/index.ts"),
      "@thalon/judge": path.resolve(dirname, "../proprietary/judge/src/index.ts"),
      "@thalon/platform": path.resolve(dirname, "../packages/platform/src/index.ts"),
    },
  },
  test: {
    name: "eval",
    environment: "node",
    // PGlite is WASM; first boot per test file can be slow on CI.
    testTimeout: 30_000,
  },
});
