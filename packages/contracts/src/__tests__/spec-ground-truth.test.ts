import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THE SPEC GROUND-TRUTH RATCHET — founder directive, s87, verbatim: *"make
 * sure you include all the dependencies, exact paths, schemas, and so on when
 * planning/speccing the features, so we can keep track and design the flow,
 * frontend and backend properly … if it does [make it better] then ratchet
 * that."*
 *
 * The evidence it ratchets: the s87 kickoffs that carried exact frozen shapes
 * ("THE WINDOW AS FROZEN") let two lanes ship without one false stop, while
 * the one spec passage that cited a charter list instead of the repo produced
 * a lane aimed at a feature that had been built for ten sessions (the ve4
 * incident — `docs/video-arc/spec.md`'s correction block). Grounded specs
 * work; ungrounded ones burn budget. So the grounding is CHECKED, not asked
 * for:
 *
 *  - every repo path a governing spec or ACTIVE kickoff cites in backticks
 *    must exist on disk, OR be explicitly marked as future work —
 *    `(new …)` / `(planned …)` right after the citation. The mark is the
 *    point: a reader can always tell an existing dependency from a promised
 *    artifact, which is exactly the founder's "keep track" ask;
 *  - every `…Schema` symbol cited must be exported somewhere under
 *    `packages/<pkg>/src`, under the same mark rule.
 *
 * What this deliberately does NOT catch: the ve4 failure's inverse (claiming
 * something does NOT exist when it does) — no static check can. That half
 * stays discipline: AGENTS.md rule 12, ground before speccing.
 *
 * Scope: `docs/<slug>/spec.md` (the house spec home) + kickoffs in
 * `agent_handoff/lanes/` that have no matching WRAP file — a wrapped lane's
 * kickoff is history and may rot freely (zero-maintenance historical marker).
 */

const dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(dirname, "..", "..", "..", "..");

/** Kickoffs with no wrap that are nonetheless historical — exempt WITH a reason. */
const KICKOFF_EXEMPT: Record<string, string> = {
  "KICKOFF-editor-polish.md": "pre-s87 lane, absorbed into the s80/81 editor fix sessions — no wrap was written",
  "KICKOFF-sched-spine.md": "pre-s87 lane, absorbed into the D0 queue-spine work — no wrap was written",
};

const PATH_ROOTS = ["packages/", "apps/", "docs/", "scripts/", "proprietary/", "agent_handoff/"];
/** A citation followed (within this window) by one of these words is declared future work. */
const FUTURE_MARK = /^[\s—–-]*\((new|planned|future|unbuilt)\b/i;
const MARK_WINDOW = 24;

function specFiles(): string[] {
  const files: string[] = [];
  const docsDir = path.join(repoRoot, "docs");
  for (const entry of readdirSync(docsDir)) {
    const candidate = path.join(docsDir, entry, "spec.md");
    if (existsSync(candidate)) files.push(candidate);
  }
  const lanesDir = path.join(repoRoot, "agent_handoff", "lanes");
  for (const entry of readdirSync(lanesDir)) {
    if (!entry.startsWith("KICKOFF-")) continue;
    if (KICKOFF_EXEMPT[entry]) continue;
    const wrap = path.join(lanesDir, entry.replace(/^KICKOFF-/, "WRAP-"));
    if (existsSync(wrap)) continue; // wrapped lane = historical
    files.push(path.join(lanesDir, entry));
  }
  return files;
}

interface Citation {
  file: string;
  token: string;
  marked: boolean;
}

function citations(): { paths: Citation[]; schemas: Citation[] } {
  const paths: Citation[] = [];
  const schemas: Citation[] = [];
  for (const file of specFiles()) {
    const text = readFileSync(file, "utf8");
    const rel = path.relative(repoRoot, file);
    const backtick = /`([^`\n]+)`/g;
    for (let m = backtick.exec(text); m; m = backtick.exec(text)) {
      const token = m[1];
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + MARK_WINDOW);
      const marked = FUTURE_MARK.test(after);
      if (
        PATH_ROOTS.some((r) => token.startsWith(r)) &&
        token.includes("/") &&
        !/[<>|…\s]/.test(token)
      ) {
        paths.push({ file: rel, token, marked });
      } else if (/^[a-z][A-Za-z0-9]+Schema$/.test(token)) {
        schemas.push({ file: rel, token, marked });
      }
    }
  }
  return { paths, schemas };
}

/** Resolve a cited path to something stat-able: strip glob tails, keep literal [dynamic] segments. */
function checkablePath(token: string): string {
  // `file.ts:65` / `file.ts:65-99` — the HOUSE citation form (CLAUDE.md: "Reference
  // code as file_path:line_number — it's clickable"). The line suffix is stripped and
  // the FILE is what must exist; line numbers are deliberately not verified because
  // they shift under every edit and a ratchet that goes red on unrelated churn gets
  // disabled. Added s88: the ratchet rejected its own repo's citation convention, so
  // the only way to satisfy it was to cite LESS precisely — backwards for a check
  // whose whole purpose is precise dependencies (found by the lane kickoff that
  // cited `pipeline.ts:65`).
  const t = token.replace(/:\d+(?:[-–]\d+)?$/, "");
  const hadGlob = t.includes("*");
  let p = hadGlob ? t.slice(0, t.indexOf("*")) : t;
  if (p.endsWith("/")) p = p.slice(0, -1);
  // ONLY a glob strip may fall back to the parent (`repos/publication-metrics*`
  // → the repos dir). A plain missing FILE must fail — forgiving any file whose
  // directory exists would gut the ratchet (caught by this file's own red-check:
  // the first cut passed a citation of a file that does not exist yet).
  if (hadGlob && !existsSync(path.join(repoRoot, p)) && p.includes("/")) {
    const dir = path.dirname(p);
    if (existsSync(path.join(repoRoot, dir))) return dir;
  }
  return p;
}

function allPackageSource(): string {
  const chunks: string[] = [];
  const packagesDir = path.join(repoRoot, "packages");
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
      const full = path.join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (entry.endsWith(".ts")) chunks.push(readFileSync(full, "utf8"));
    }
  };
  for (const pkg of readdirSync(packagesDir)) {
    const src = path.join(packagesDir, pkg, "src");
    if (existsSync(src)) walk(src);
  }
  return chunks.join("\n");
}

describe("spec ground truth (founder directive s87 — dependencies as facts, not prose)", () => {
  const { paths, schemas } = citations();

  it("scans a real corpus (the ratchet must never pass by scanning nothing)", () => {
    expect(specFiles().length).toBeGreaterThanOrEqual(3); // the three governing specs at minimum
    expect(paths.length).toBeGreaterThan(20);
  });

  it("every cited repo path exists, or is explicitly marked (new/planned)", () => {
    const missing = paths
      .filter((c) => !c.marked)
      .filter((c) => !existsSync(path.join(repoRoot, checkablePath(c.token))));
    expect(
      missing.map((c) => `${c.file} → \`${c.token}\``),
      "a spec cites a path that does not exist — either the citation is wrong (fix it: ground truth, not prose) or it is future work (mark it `(new)`/`(planned)` right after the backticks)",
    ).toEqual([]);
  });

  it("every cited …Schema symbol is exported from a package, or marked future", () => {
    const source = allPackageSource();
    const missing = schemas
      .filter((c) => !c.marked)
      .filter(
        (c) =>
          !source.includes(`export const ${c.token}`) &&
          !source.includes(`export function ${c.token}`),
      );
    expect(
      missing.map((c) => `${c.file} → \`${c.token}\``),
      "a spec cites a schema no package exports — wrong name, or unmarked future work",
    ).toEqual([]);
  });

  it("the historical-kickoff exemptions stay honest (file exists, wrap genuinely absent)", () => {
    const lanesDir = path.join(repoRoot, "agent_handoff", "lanes");
    for (const [name, reason] of Object.entries(KICKOFF_EXEMPT)) {
      expect(reason.length).toBeGreaterThan(10);
      expect(existsSync(path.join(lanesDir, name)), `stale exemption: ${name} no longer exists`).toBe(true);
      const wrap = path.join(lanesDir, name.replace(/^KICKOFF-/, "WRAP-"));
      expect(
        existsSync(wrap),
        `${name} now HAS a wrap — the wrap rule covers it; delete the exemption`,
      ).toBe(false);
    }
  });
});
