import { COMPOSITION_GSAP_SRC } from "./composition";

/**
 * B5.1 composition validation gate (SPINE §1: "validation guard at every
 * boundary") — runs in CORE between template generation and ANY
 * chromium/render spend, in two belts:
 *
 *   1. `assertCompositionSafe` — this module's own deterministic scan of the
 *      research doc's forbidden-pattern list (the patterns that break the
 *      integer-frame-clock determinism or fetch at render time). Zero deps,
 *      always on, byte-exact. It scans only the parts the GENERATOR owns —
 *      inline <script> bodies and markup attributes — never judged text
 *      content, so a narration that happens to mention "Math.random" can't
 *      false-positive the gate.
 *
 *   2. `@hyperframes/lint`'s `lintHyperframeHtml` (pure static analysis,
 *      browser-free) — the framework's own ruleset behind an injectable
 *      seam (`CompositionLinter`), dynamic-imported so tests stay
 *      installation-independent. Belt-and-braces per the research doc.
 *
 * A finding is a HARD stop: the target throws CompositionLintError before
 * a single chromium process spawns.
 */

export interface CompositionLintFinding {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
}

export class CompositionLintError extends Error {
  readonly findings: CompositionLintFinding[];
  constructor(stage: string, findings: CompositionLintFinding[]) {
    super(
      `composition failed the ${stage} lint gate (${findings.length} finding(s)) — refusing before any render spend: ${findings
        .map((f) => `[${f.code}] ${f.message}`)
        .join("; ")}`,
    );
    this.name = "CompositionLintError";
    this.findings = findings;
  }
}

/**
 * The research doc's forbidden-pattern list as executable checks over the
 * template's inline script bodies. The generator cannot emit these by
 * construction; this scan is the ratchet that keeps that true through every
 * future template edit.
 */
export const FORBIDDEN_SCRIPT_PATTERNS: ReadonlyArray<{ code: string; pattern: RegExp; message: string }> = [
  { code: "no-wall-clock", pattern: /Date\.now|new Date\(/, message: "wall-clock reads break the integer frame clock" },
  { code: "no-raf", pattern: /requestAnimationFrame/, message: "rAF-driven animation drifts under frame-seek capture" },
  { code: "no-random", pattern: /Math\.random/, message: "unseeded randomness breaks same-composition-same-video" },
  { code: "no-render-fetch", pattern: /\bfetch\s*\(|XMLHttpRequest|new WebSocket/, message: "network fetches at render time — preload everything" },
  { code: "no-timers", pattern: /setInterval\s*\(|setTimeout\s*\(/, message: "timer-driven behavior is invisible to the frame clock" },
  { code: "no-media-control", pattern: /\.play\s*\(|\.pause\s*\(|\.currentTime/, message: "the framework manages media playback; scripts must not" },
  { code: "no-infinite-timeline", pattern: /repeat:\s*-1/, message: "infinite timelines have no renderable duration" },
  { code: "no-script-set-root", pattern: /setAttribute|dataset\.|__hfVariables/, message: "root duration/dimensions are compile-time — never script-set" },
  { code: "no-doc-write", pattern: /document\.write/, message: "document.write invalidates the compiled composition" },
];

function inlineScriptBodies(html: string): string[] {
  const bodies: string[] = [];
  const scriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  for (let m = scriptRe.exec(html); m !== null; m = scriptRe.exec(html)) bodies.push(m[1]);
  return bodies;
}

function externalScriptSrcs(html: string): string[] {
  const srcs: string[] = [];
  const srcRe = /<script[^>]*\bsrc="([^"]*)"[^>]*>/gi;
  for (let m = srcRe.exec(html); m !== null; m = srcRe.exec(html)) srcs.push(m[1]);
  return srcs;
}

/**
 * Belt 1: the always-on deterministic scan. Throws CompositionLintError on
 * the first-class violations; returns the (empty) findings list otherwise so
 * callers can compose it with the framework linter's findings.
 */
export function assertCompositionSafe(html: string): void {
  const findings: CompositionLintFinding[] = [];

  for (const src of externalScriptSrcs(html)) {
    if (src !== COMPOSITION_GSAP_SRC) {
      findings.push({
        code: "unexpected-external-script",
        severity: "error",
        message: `external script "${src}" — only the pinned GSAP runtime (${COMPOSITION_GSAP_SRC}) is preloaded`,
      });
    }
  }

  const scripts = inlineScriptBodies(html);
  for (const body of scripts) {
    for (const rule of FORBIDDEN_SCRIPT_PATTERNS) {
      if (rule.pattern.test(body)) {
        findings.push({ code: rule.code, severity: "error", message: rule.message });
      }
    }
    for (const call of body.match(/gsap\.timeline\s*\([^)]*\)/g) ?? []) {
      if (!/paused:\s*true/.test(call)) {
        findings.push({
          code: "non-paused-timeline",
          severity: "error",
          message: "GSAP timelines must be created paused (the adapter seeks them per frame)",
        });
      }
    }
  }

  // Remote references in markup (outside the pinned script preload): the
  // template embeds no media, so any http(s) attribute is a render-time
  // fetch waiting to happen.
  const markup = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const remoteAttr = /(?:src|href)="(https?:[^"]*)"/gi;
  for (let m = remoteAttr.exec(markup); m !== null; m = remoteAttr.exec(markup)) {
    findings.push({
      code: "no-remote-media",
      severity: "error",
      message: `remote reference "${m[1]}" in markup — preload everything; the deterministic template embeds no remote media`,
    });
  }

  const root = /<div[^>]*id="root"[^>]*>/i.exec(html)?.[0];
  if (!root) {
    findings.push({ code: "missing-root", severity: "error", message: "no #root composition element" });
  } else {
    for (const attr of ["data-composition-id", "data-duration", "data-width", "data-height"]) {
      if (!new RegExp(`${attr}="[^"]+"`).test(root)) {
        findings.push({
          code: "missing-root-attr",
          severity: "error",
          message: `root element lacks compile-time ${attr}`,
        });
      }
    }
  }

  if (findings.length > 0) throw new CompositionLintError("core forbidden-pattern", findings);
}

/**
 * Project-level belt 1 (composition v2): every file passes the single-file
 * scan, every `data-composition-src` the root references exists in the
 * project, and composition ids stay unique — the cross-file mistakes a
 * per-string scan cannot see. Same hard-stop semantics.
 */
export function assertCompositionProjectSafe(files: Record<string, string>): void {
  const findings: CompositionLintFinding[] = [];
  for (const [name, html] of Object.entries(files)) {
    try {
      assertCompositionSafe(html);
    } catch (err) {
      if (err instanceof CompositionLintError) {
        findings.push(
          ...err.findings.map((f) => ({ ...f, message: `${name}: ${f.message}` })),
        );
      } else {
        throw err;
      }
    }
  }

  const ids = new Map<string, string>();
  for (const [name, html] of Object.entries(files)) {
    const idRe = /data-composition-id="([^"]*)"/gi;
    for (let m = idRe.exec(html); m !== null; m = idRe.exec(html)) {
      const prior = ids.get(m[1]);
      if (prior) {
        findings.push({
          code: "duplicate-composition-id",
          severity: "error",
          message: `composition id "${m[1]}" appears in both ${prior} and ${name} — timeline registration keys must be unique`,
        });
      } else {
        ids.set(m[1], name);
      }
    }
  }

  const srcRe = /data-composition-src="([^"]*)"/gi;
  for (const [name, html] of Object.entries(files)) {
    for (let m = srcRe.exec(html); m !== null; m = srcRe.exec(html)) {
      if (!(m[1] in files)) {
        findings.push({
          code: "missing-sub-composition",
          severity: "error",
          message: `${name} mounts "${m[1]}" but the project emits no such file`,
        });
      }
    }
    srcRe.lastIndex = 0;
  }

  if (findings.length > 0) throw new CompositionLintError("core project", findings);
}

/** Belt 2 seam: the framework's own static linter, injectable so tests never need the package installed. */
export type CompositionLinter = (html: string) => Promise<{
  ok: boolean;
  errorCount: number;
  findings: CompositionLintFinding[];
}>;

interface HyperframesLintModule {
  lintHyperframeHtml(html: string): Promise<{
    ok: boolean;
    errorCount: number;
    warningCount: number;
    findings: Array<{ code: string; severity: "error" | "warning" | "info"; message: string }>;
  }>;
}

/** Non-literal specifier: TS/vitest must not try to resolve the optional package at build time — it exists only after the lead installs the pinned deps in main. */
function dynamicImport(specifier: string): Promise<unknown> {
  return import(specifier);
}

/**
 * The default CompositionLinter: `@hyperframes/lint`'s `lintHyperframeHtml`
 * (version-pinned in package.json; Apache 2.0). Deliberately NOT
 * `lintMediaUrls` — that belt issues network HEAD checks, and our template
 * embeds no remote media by construction (assertCompositionSafe enforces
 * it), so the gate stays fully offline.
 */
export function hyperframesLinter(): CompositionLinter {
  return async (html) => {
    let mod: HyperframesLintModule;
    try {
      mod = (await dynamicImport("@hyperframes/lint")) as HyperframesLintModule;
    } catch (err) {
      throw new Error(
        `@hyperframes/lint is not installed — the pinned dep is in packages/engine/package.json; run npm install from the MAIN checkout (never inside a worktree). Cause: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
    const result = await mod.lintHyperframeHtml(html);
    return {
      ok: result.ok,
      errorCount: result.errorCount,
      findings: result.findings.map((f) => ({ code: f.code, severity: f.severity, message: f.message })),
    };
  };
}

/** Runs belt 2 and converts error-severity findings into the same loud stop as belt 1. Warnings/infos pass (they are advisory; the report surfaces them via the thrown error only when errors block). */
export async function runCompositionLintGate(html: string, linter: CompositionLinter): Promise<void> {
  const result = await linter(html);
  if (result.errorCount > 0 || !result.ok) {
    throw new CompositionLintError(
      "hyperframes",
      result.findings.filter((f) => f.severity === "error"),
    );
  }
}
