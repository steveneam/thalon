import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // The dev-mode distDir (next.config.ts forks distDir on NODE_ENV).
    // eslint flat config does NOT inherit .gitignore, so the fork must be
    // ignored here too or any prior `next dev` run makes lint scan build
    // output (caught at the B6.2 merge verification).
    ".next-dev/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Boundary ratchets (amendment A3; SPINE §3.4). Mirrored by the
    // repo-wide scan in tests/boundary.test.ts.
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@thalon/db/*"],
              message:
                "Import @thalon/db root only — the tenant-scoped repositories are the API (SPINE §2.6).",
            },
            {
              group: ["**/shell/**"],
              message:
                "shell/ modules are the LLM quarantine — apps/web never imports them (SPINE §1).",
            },
            {
              group: [
                "drizzle-orm",
                "drizzle-orm/*",
                "@electric-sql/pglite",
                "@electric-sql/pglite/*",
              ],
              message: "No DB access outside @thalon/db repositories (SPINE §2.2).",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
