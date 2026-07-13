import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The engine barrel is imported by playwright-less consumers — most
 * critically apps/web's standalone image, which traces playwright-core
 * WITHOUT its assets (browsers.json). A module-scope playwright import
 * anywhere in the barrel graph therefore crashes every engine-touching
 * web route at boot: the 2026-07-13 staging incident (/blog, /sitemap.xml,
 * /llms.txt, /blog/rss.xml all 500) traced to exactly this via
 * demo/playwright-driver.ts. Invariant: engine source may only load
 * playwright lazily (`await import(...)` at drive time) or as erased
 * `import type`; a module-scope value import anywhere in src/ regresses
 * the web image. (vi.doMock cannot pin this — externalized node_modules
 * imports bypass the mock registry, proven by red-check — so this scans
 * the source directly.)
 */

const SRC_ROOT = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : sourceFiles(path);
    }
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

/** Module-scope value imports of playwright: `import { chromium } from "playwright"`, `import pw from "playwright-core"`, bare `import "playwright"` — but never `import type` (erased) or `await import(...)` (lazy). */
const EAGER_PLAYWRIGHT_IMPORT = /^import\s+(?!type\b)[^;]*?["']playwright(?:-core)?["']/m;

describe("engine barrel import purity", () => {
  it("no engine source module value-imports playwright at module scope", () => {
    const offenders = sourceFiles(SRC_ROOT).filter((file) =>
      EAGER_PLAYWRIGHT_IMPORT.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
