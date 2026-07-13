import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Root lint (B2.2 ratchet): covers packages/, proprietary/, eval/, and root
 * config files. apps/web keeps its own Next-specific flat config (run via
 * `npm run lint -w @thalon/web`; the root `lint` script chains both) â€” CI
 * runs the chain so lint findings surface on the PR, not at lead merge (the
 * B1.4 lesson). Import-boundary enforcement stays in tests/boundary.test.ts
 * (repo-wide, already in CI via `npm test`).
 */
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "apps/**",
      "**/.next/**",
      "**/dist/**",
      "packages/db/drizzle/**",
      "eval/deepeval/**",
      "infra/**",
      ".claude/**",
      // Gitignored vault-pointer/operator-data dir: CI never sees it (lints
      // tracked files only) — local lint must match CI semantics, not fail
      // on dropped-in client/tool files.
      ".context/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // B4.7: scripts/*.mjs run under Node (npm run doctor) — declare the
    // runtime globals the recommended config doesn't assume for .mjs files.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
