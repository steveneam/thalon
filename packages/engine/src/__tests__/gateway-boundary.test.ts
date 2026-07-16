import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * B4.4 metering-boundary ratchet (CHARTER A10; B1.4 lesson — the judge's
 * real driver once bypassed budget/tracing entirely): `getGateway` may be
 * touched ONLY by shell driver modules, whose invocations the core wraps in
 * `withGatewayGuard` (budget asserted before, usage recorded after, span
 * traced — the ONE gateway choke point, SPINE §1/A2). Any new file that
 * reaches for `getGateway` fails this scan until it is either rewritten to
 * take a guarded driver, or consciously added to the allowlist as a shell.
 */

const dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(dirname, "..", "..", "..", "..");

/** Every sanctioned `getGateway` site: the definition + the shell drivers (+ this ratchet). */
const ALLOWED = new Set(
  [
    "packages/platform/src/gateway.ts",
    "packages/engine/src/fanout/shell/generator.ts",
    "packages/engine/src/origination/shell/generator.ts",
    "packages/engine/src/outreach/shell/generator.ts",
    "packages/engine/src/edl/shell/generator.ts",
    "packages/engine/src/webpage/shell/generator.ts",
    "packages/engine/src/waterfall/shell/generator.ts",
    "packages/engine/src/demo/shell/generator.ts",
    "packages/engine/src/direction/shell/generator.ts",
    "packages/engine/src/search/shell/expander.ts",
    "packages/engine/src/trend/shell/dossier.ts",
    "packages/engine/src/ingest/shell/embedder.ts",
    "proprietary/judge/src/shell/driver.ts",
    "packages/engine/src/__tests__/gateway-boundary.test.ts",
  ].map((p) => path.normalize(p)),
);

const SCAN_ROOTS = ["packages", "proprietary", "apps", "eval"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".next", "drizzle", "coverage", ".turbo"]);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name));
    } else if (/\.(ts|tsx|mts|cts)$/.test(entry.name)) {
      yield path.join(dir, entry.name);
    }
  }
}

describe("gateway metering boundary (B4.4 ratchet)", () => {
  it("no module outside the shell allowlist touches getGateway", () => {
    const violations: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of walk(path.join(repoRoot, root))) {
        if (!/\bgetGateway\b/.test(readFileSync(file, "utf8"))) continue;
        const rel = path.normalize(path.relative(repoRoot, file));
        if (!ALLOWED.has(rel)) violations.push(rel);
      }
    }
    expect(
      violations,
      `these files reach getGateway outside the shell allowlist — route the call through a driver the core wraps in withGatewayGuard: ${violations.join(", ")}`,
    ).toEqual([]);
  });

  it("every allowlisted shell file still exists (a stale allowlist entry hides a moved call site)", () => {
    for (const rel of ALLOWED) {
      expect(() => readFileSync(path.join(repoRoot, rel), "utf8"), rel).not.toThrow();
    }
  });
});
