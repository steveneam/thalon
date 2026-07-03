import { defineConfig } from "vitest/config";

// One `npm test` at the root runs every workspace suite plus the repo-wide
// ratchet tests in tests/ (import-boundary scans that no single package owns).
export default defineConfig({
  test: {
    projects: [
      "apps/web/vitest.config.ts",
      "packages/*/vitest.config.ts",
      {
        test: {
          name: "repo-ratchets",
          environment: "node",
          include: ["tests/**/*.test.ts"],
        },
      },
    ],
  },
});
