import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * B5.3 shell-inventory pin (amendment A11; SPINE §1). The doctrine's "shell
 * inventory — the only places LLMs are allowed" was documentary prose that
 * silently grew from 4 families to 8 as buckets landed. This promotes it to
 * an EXECUTABLE ratchet: the set of `operation:` labels handed to
 * `withGatewayGuard` — the one gateway choke point every LLM call routes
 * through (SPINE §1; A2) — is pinned here, so a NEW model call site cannot
 * merge without editing this list. Adding an LLM operation is thereby a
 * deliberate, review-visible act, not an accident.
 *
 * Sibling ratchet: gateway-boundary.test.ts proves the gateway accessor is
 * reachable ONLY from shell drivers. Together they bound the boundary from
 * both sides — where the gateway is touched, and what operations meter
 * through the guard. (That sibling scans every .ts file for the accessor's
 * bare token, so this comment deliberately does not spell it out.)
 *
 * When you genuinely add an LLM call site: add its operation label below AND
 * refresh the SPINE §1 shell-inventory sentence (docs/SPINE.md). A failure
 * here means an operation appeared or vanished — reconcile intentionally.
 */

const dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(dirname, "..", "..", "..", "..");

/**
 * THE shell inventory: every operation label metered through
 * `withGatewayGuard`, as the literal source expression. The judge site is a
 * template (`judge.${GATE_FOR_TIER[tier]}`) that expands at runtime to
 * exactly `judge.g3_screen` and `judge.g3_final` — one source site, two
 * gates. Everything else is a plain string literal.
 */
const EXPECTED_SHELL_OPERATIONS: ReadonlyArray<{ op: string; note: string }> = [
  { op: '"ingest.embed"', note: "B1.1 — source-chunk embeddings" },
  { op: '"fanout.generate"', note: "B1.2 — one source → N platform drafts" },
  { op: '"waterfall.highlight_select"', note: "B2.3 — clip-window highlight select" },
  { op: '"demo.storyboard"', note: "B2.5 — site-demo storyboard" },
  { op: '"origination.pillar_script"', note: "B3.9 — one-shot pillar script" },
  { op: '"webpage.web_page"', note: "B3.15 — landing-page generation" },
  { op: '"staged_video.structure"', note: "B5.2 — staged video, structure stage (storyboard)" },
  { op: '"staged_video.scenes"', note: "B5.2 — staged video, scenes/effects fill" },
  { op: '"staged_video.polish"', note: "B5.2 — staged video, polish refine" },
  { op: '"search.keyword_expand"', note: "B6.8 — judged AI keyword expansion (search targets; G1 + deterministic grounding gate candidates before persist)" },
  { op: '"intel.dossier"', note: "B6.5 half-step — trend-card dossier (titles/angles/hook; G1 denylist gates before the wire; per-sweep ration TREND_DOSSIER_CARDS, default disarmed)" },
  { op: "`judge.${GATE_FOR_TIER[tier]}`", note: "B1.3 — G3 two-tier grounding (→ judge.g3_screen | judge.g3_final)" },
];

const SCAN_ROOTS = ["packages", "proprietary"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".next", "drizzle", "coverage", ".turbo", "__tests__"]);
/** The guard's own definition carries `operation: string` (a type, not a call) and doc examples — never a call site. */
const SKIP_FILES = new Set([path.normalize("packages/platform/src/gateway-guard.ts")]);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name));
    } else if (/\.ts$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      yield path.join(dir, entry.name);
    }
  }
}

/** Captures every `operation:` whose value is a string/template literal (a `operation: string` type annotation has no quote/backtick and is skipped). */
const OPERATION_RE = /operation:\s*("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g;

interface FoundOp {
  op: string;
  file: string;
}

function collectOperations(): { ops: FoundOp[]; guardCallSites: number } {
  const ops: FoundOp[] = [];
  let guardCallSites = 0;
  for (const root of SCAN_ROOTS) {
    for (const file of walk(path.join(repoRoot, root))) {
      const rel = path.normalize(path.relative(repoRoot, file));
      if (SKIP_FILES.has(rel)) continue;
      const src = readFileSync(file, "utf8");
      guardCallSites += (src.match(/withGatewayGuard\s*\(/g) ?? []).length;
      for (const m of src.matchAll(OPERATION_RE)) ops.push({ op: m[1], file: rel });
    }
  }
  return { ops, guardCallSites };
}

describe("shell inventory (B5.3 executable pin, SPINE §1)", () => {
  it("the metered LLM-operation set is EXACTLY the pinned inventory", () => {
    const { ops } = collectOperations();
    const found = new Set(ops.map((o) => o.op));
    const expected = new Set(EXPECTED_SHELL_OPERATIONS.map((e) => e.op));

    const added = [...found].filter((o) => !expected.has(o));
    const removed = [...expected].filter((o) => !found.has(o));
    expect(
      { added, removed },
      "the withGatewayGuard operation set drifted from the pinned shell inventory — a NEW LLM call site (added) or a removed one. Update EXPECTED_SHELL_OPERATIONS here AND the SPINE §1 shell-inventory sentence, deliberately.",
    ).toEqual({ added: [], removed: [] });
  });

  it("every withGatewayGuard call site carries a pinned operation (count matches — a new site with a reused label is still caught)", () => {
    const { ops, guardCallSites } = collectOperations();
    // One guarded operation label per guarded call site: 10 string literals +
    // the single judge template site = 11.
    expect(guardCallSites).toBe(EXPECTED_SHELL_OPERATIONS.length);
    expect(ops.length).toBe(EXPECTED_SHELL_OPERATIONS.length);
  });

  it("pins the judge template as the only dynamic operation (its two runtime gates are documented, not free-form)", () => {
    const { ops } = collectOperations();
    const templates = ops.filter((o) => o.op.startsWith("`"));
    expect(templates.map((t) => t.op)).toEqual(["`judge.${GATE_FOR_TIER[tier]}`"]);
  });
});
