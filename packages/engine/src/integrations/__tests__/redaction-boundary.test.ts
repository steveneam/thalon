import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * B-int.1 redaction boundary (ADR 0011: "secrets never in events, logs,
 * errors, or API responses"). The events/errors/responses legs are pinned
 * behaviorally (b-int0-repos, crypto, vault tests); the LOGS leg is pinned
 * structurally here: the vault modules contain NO logging call and NO
 * direct process-environment read (the validated env arrives through deps —
 * platform stays the one reader). A future edit that adds a debug print to
 * a code path holding plaintext fails this scan before it can ship.
 */

const dirname = fileURLToPath(new URL(".", import.meta.url));
const integrationsRoot = path.resolve(dirname, "..");

// Built by concatenation so this test's own source never contains the
// literals the sibling boundary ratchets grep for.
const FORBIDDEN = [
  { pattern: new RegExp("\\bconsole\\s*\\."), label: "a console logging call" },
  { pattern: new RegExp("process\\s*\\.\\s*" + "env"), label: "a direct process-environment read" },
];

function productionFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : productionFiles(file);
    }
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [file] : [];
  });
}

describe("vault redaction boundary (B-int.1 ratchet)", () => {
  it("no vault module logs or reads the process environment directly", () => {
    const violations: string[] = [];
    for (const file of productionFiles(integrationsRoot)) {
      const source = readFileSync(file, "utf8");
      for (const { pattern, label } of FORBIDDEN) {
        if (pattern.test(source)) {
          violations.push(`${path.relative(integrationsRoot, file)}: ${label}`);
        }
      }
    }
    expect(
      violations,
      `the vault modules must stay log-free and env-indirect (redaction invariant): ${violations.join("; ")}`,
    ).toEqual([]);
  });

  it("scans a non-empty module set (a moved directory would silently hollow this ratchet)", () => {
    expect(productionFiles(integrationsRoot).length).toBeGreaterThanOrEqual(5);
  });
});
