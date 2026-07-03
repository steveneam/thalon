import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    // PGlite (WASM) first boot per test file can be slow, same as packages/db.
    testTimeout: 30_000,
  },
});
