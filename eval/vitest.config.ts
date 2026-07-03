import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "eval",
    environment: "node",
    // PGlite is WASM; first boot per test file can be slow on CI.
    testTimeout: 30_000,
  },
});
