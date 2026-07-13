import path from "node:path";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

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
      "@thalon/engine": path.resolve(dirname, "../../packages/engine/src/index.ts"),
      "@thalon/platform": path.resolve(dirname, "../../packages/platform/src/index.ts"),
      "@thalon/judge": path.resolve(dirname, "../../proprietary/judge/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    // Next's standalone output traces src — co-located tests included —
    // into .next/standalone, so any checkout with a build present re-runs
    // those copies (the 1050-vs-1012 cross-machine suite-count drift,
    // diagnosed 2026-07-13). .next-dev is the dev-server distDir twin.
    exclude: [...configDefaults.exclude, "**/.next/**", "**/.next-dev/**"],
    setupFiles: ["./src/test/setup.ts"],
    // PGlite (WASM) first boot per test file can be slow, same as packages/db.
    testTimeout: 30_000,
    // The route tests open that same PGlite in beforeEach hooks — under
    // multi-lane load the boot blows the 10s hook default the same way
    // (proven live 2026-07-07: "Hook timed out in 10000ms" at openTestDb).
    hookTimeout: 30_000,
  },
});
