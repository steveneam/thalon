import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Import-boundary ratchets (amendment A3; SPINE §3.4). These make the
 * DCPS doctrine and tenancy discipline structural:
 *  1. apps/web never imports @thalon/db internals, db drivers, or shell/ code
 *     — routes stay thin and all data access goes through repositories.
 *  2. shell/ modules (the LLM quarantine) never import @thalon/db — the
 *     shell is read-only and returns candidate values; only core persists.
 *  3. process.env is read ONLY in packages/platform/src/env.ts.
 */

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function sourceFiles(dir: string): string[] {
  const abs = path.join(repoRoot, dir);
  const out: string[] = [];
  const walk = (d: string) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return; // directory may not exist yet (e.g. engine shell/ pre-B1.1)
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx|mts)$/.test(e.name)) out.push(p);
    }
  };
  walk(abs);
  return out;
}

function offenders(files: string[], pattern: RegExp): string[] {
  return files
    .filter((f) => pattern.test(readFileSync(f, "utf8")))
    .map((f) => path.relative(repoRoot, f));
}

describe("import boundaries", () => {
  it("apps/web imports no db internals, db drivers, or shell modules", () => {
    const files = sourceFiles("apps/web/src");
    expect(files.length).toBeGreaterThan(0);
    expect(
      offenders(
        files,
        /from\s+["'](@thalon\/db\/|[^"']*\/shell\/|drizzle-orm|@electric-sql\/pglite|better-sqlite3)/,
      ),
    ).toEqual([]);
  });

  it("shell/ modules never import @thalon/db (the shell is read-only)", () => {
    const shellFiles = [
      ...sourceFiles("packages/engine/src"),
      ...sourceFiles("proprietary/judge/src"),
    ].filter((f) => f.split(path.sep).includes("shell"));
    expect(offenders(shellFiles, /from\s+["']@thalon\/db/)).toEqual([]);
  });

  it("process.env is read only in packages/platform/src/env.ts", () => {
    const files = [
      ...sourceFiles("packages"),
      ...sourceFiles("proprietary"),
    ].filter(
      (f) =>
        !f.endsWith(path.join("platform", "src", "env.ts")) &&
        !/\.test\.ts$/.test(f),
    );
    expect(offenders(files, /process\.env/)).toEqual([]);
  });
});
