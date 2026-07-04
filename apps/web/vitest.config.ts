import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    // Worktree lanes share one node_modules symlinked to the main checkout
    // (AGENTS.md), so @thalon/* entries under it point at the main
    // checkout's packages, not this worktree's local edits (packages/engine's
    // vitest.config.ts is the reference pattern this mirrors).
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@thalon/contracts": path.resolve(dirname, "../../packages/contracts/src/index.ts"),
      "@thalon/db": path.resolve(dirname, "../../packages/db/src/index.ts"),
      "@thalon/platform": path.resolve(dirname, "../../packages/platform/src/index.ts"),
      "@thalon/judge": path.resolve(dirname, "../../proprietary/judge/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    // PGlite (WASM) first boot per test file can be slow, same as packages/db.
    testTimeout: 30_000,
  },
});
