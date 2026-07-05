#!/usr/bin/env node
/**
 * `npm run doctor` — per-seam live-capability readiness report (B4.7,
 * amendment A10 decision 3). Keyless, offline-tolerant, zero live spend.
 *
 * This is a READINESS REPORT, not a gate: a missing tool prints as
 * `not-live-ready` / `fake-only` with the exact install command to fix it,
 * and the process still exits 0. Non-zero exits are reserved for doctor
 * being unable to produce a report at all (e.g. its own parsers failing
 * selfCheck()). Every external probe is wrapped: no missing binary, hung
 * process, or unreadable directory can crash the report.
 *
 * Seams covered (the pass-3 toolchain, installed machine-global except
 * the render/engine packages which are engine deps):
 *   render     — Hyperframes (B5.1, amendment A11): @hyperframes/producer +
 *                @hyperframes/lint version-pinned in the engine package +
 *                `npx hyperframes doctor` as the per-seam probe (its
 *                FFmpeg/FFprobe/Chrome rows are what a render needs; the
 *                rest are optional capability tiers). Licence: Apache 2.0,
 *                free at any scale — NO GATE (decision record
 *                docs/adr/0004-render-driver-default.md; the A6 Remotion
 *                growth gate is retired — Remotion is the recorded swap
 *                path behind the same RenderTarget seam).
 *   transcript — ffmpeg on PATH + faster-whisper importable + a local
 *                Whisper model present in the HuggingFace hub cache.
 *   deploy     — Vercel CLI on PATH.
 *   trend      — fake-only BY DESIGN in pass 2 (official-API pollers are
 *                pass-3 work; there is no tool to install).
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  HYPERFRAMES_ESSENTIAL_CHECKS,
  parseBareVersion,
  parseFfmpegVersion,
  parseHyperframesDoctor,
  parsePythonVersion,
  parseVercelVersion,
  readiness,
  renderTable,
  seamRow,
  selfCheck,
  whisperModelsFrom,
} from "./doctor-checks.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROBE_TIMEOUT_MS = 30_000;

/**
 * Runs one probe command, merged stdout+stderr (npm shims and some CLIs
 * print versions to stderr). Never throws — a spawn failure, non-zero exit,
 * or timeout resolves to { ok: false }. Windows needs shell:true for npm
 * .cmd shims (same handling as platform's claude-cli transport); every
 * argument here is a literal, so the joined command line is shell-safe.
 */
function probe(cmd, args, envOverrides = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env, ...envOverrides };
    let child;
    try {
      child =
        process.platform === "win32"
          ? spawn([cmd, ...args].join(" "), { shell: true, windowsHide: true, env })
          : spawn(cmd, args, { windowsHide: true, env });
    } catch (err) {
      resolve({ ok: false, output: String(err?.message ?? err) });
      return;
    }
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, output: `probe timed out after ${PROBE_TIMEOUT_MS}ms` });
    }, PROBE_TIMEOUT_MS);
    child.stdout?.on("data", (d) => (output += d.toString()));
    child.stderr?.on("data", (d) => (output += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, output: String(err?.message ?? err) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, output });
    });
  });
}

/** Reads an installed package's version by walking the workspace node_modules candidates. */
function installedPackageVersion(pkgName) {
  const candidates = [
    path.join(repoRoot, "node_modules", ...pkgName.split("/"), "package.json"),
    path.join(repoRoot, "packages", "engine", "node_modules", ...pkgName.split("/"), "package.json"),
  ];
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return JSON.parse(readFileSync(candidate, "utf8")).version ?? null;
    } catch {
      /* unreadable install — treated as absent */
    }
  }
  return null;
}

/** Whisper models in the HuggingFace hub cache (HF_HOME respected; default ~/.cache/huggingface). */
function cachedWhisperModels() {
  const hfHome = process.env.HF_HOME || path.join(homedir(), ".cache", "huggingface");
  const hub = path.join(hfHome, "hub");
  try {
    return whisperModelsFrom(readdirSync(hub));
  } catch {
    return [];
  }
}

const RENDER_LICENCE_NOTE =
  "licence: Apache 2.0, free at any scale — NO gate (ADR-0004; A6 Remotion growth gate retired)";

/**
 * B5.1: the render seam is Hyperframes — pinned packages resolvable + the
 * framework's own `hyperframes doctor` probe (`--no-install` so the probe
 * never mutates anything; the CLI is an engine devDependency). Telemetry is
 * opted out for the probe itself (HYPERFRAMES_NO_TELEMETRY, ADR-0004).
 */
async function renderSeam() {
  const producer = installedPackageVersion("@hyperframes/producer");
  const lint = installedPackageVersion("@hyperframes/lint");
  const remotion = installedPackageVersion("remotion");
  const swapNote = `swap path: remotion ${remotion ?? "not installed"} (recorded, unwired — ADR-0004)`;

  if (!producer || !lint) {
    return seamRow(
      "render",
      "not-live-ready",
      `@hyperframes/producer ${producer ?? "MISSING"}, @hyperframes/lint ${lint ?? "MISSING"}; ${RENDER_LICENCE_NOTE}; ${swapNote}`,
      "npm install (from the MAIN checkout, never inside a worktree — the pinned deps are in packages/engine/package.json)",
    );
  }

  const doctor = await probe("npx", ["--no-install", "hyperframes", "doctor"], {
    HYPERFRAMES_NO_TELEMETRY: "1",
  });
  const report = parseHyperframesDoctor(doctor.output);
  if (!doctor.ok || !report) {
    return seamRow(
      "render",
      "not-live-ready",
      `@hyperframes/producer ${producer} + @hyperframes/lint ${lint} installed, but \`npx hyperframes doctor\` produced no report; ${RENDER_LICENCE_NOTE}`,
      "npm install (from the MAIN checkout) — the hyperframes CLI is a pinned engine devDependency",
    );
  }

  const essentialsMissing = HYPERFRAMES_ESSENTIAL_CHECKS.filter((name) => report.failed.includes(name));
  const informational = report.failed.filter((name) => !HYPERFRAMES_ESSENTIAL_CHECKS.includes(name));
  const infoNote = informational.length
    ? `optional checks failing: ${informational.join(", ")} (capability tiers, not render-blocking)`
    : "all hyperframes doctor checks green";
  if (essentialsMissing.length > 0) {
    return seamRow(
      "render",
      "not-live-ready",
      `hyperframes ${producer} installed but essentials failing: ${essentialsMissing.join(", ")}; ${infoNote}; ${RENDER_LICENCE_NOTE}`,
      "run `npx hyperframes doctor` for each check's exact fix hint",
    );
  }
  return seamRow(
    "render",
    "live-ready",
    `@hyperframes/producer ${producer} + @hyperframes/lint ${lint}; hyperframes doctor essentials green (${HYPERFRAMES_ESSENTIAL_CHECKS.join("/")}); ${infoNote}; ${RENDER_LICENCE_NOTE}; ${swapNote}`,
  );
}

async function transcriptSeam() {
  const [ffmpeg, python, whisper] = await Promise.all([
    probe("ffmpeg", ["-version"]),
    probe("python", ["--version"]),
    probe("python", ["-c", '"import faster_whisper; print(faster_whisper.__version__)"']),
  ]);
  const ffmpegVersion = ffmpeg.ok ? parseFfmpegVersion(ffmpeg.output) : null;
  const pythonVersion = python.ok ? parsePythonVersion(python.output) : null;
  const whisperVersion = whisper.ok ? parseBareVersion(whisper.output.trim()) : null;
  const models = cachedWhisperModels();

  const parts = [
    { ok: !!ffmpegVersion, label: `ffmpeg ${ffmpegVersion ?? "MISSING"}` },
    { ok: !!pythonVersion, label: `python ${pythonVersion ?? "MISSING"}` },
    { ok: !!whisperVersion, label: `faster-whisper ${whisperVersion ?? "MISSING"}` },
    { ok: models.length > 0, label: models.length ? `model(s): ${models.join(", ")}` : "whisper model: MISSING" },
  ];
  const status = readiness(parts);
  const fixes = [];
  if (!ffmpegVersion)
    fixes.push(
      "winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements (then open a fresh terminal)",
    );
  if (!pythonVersion) fixes.push("install Python 3.10+ (python.org) and re-run");
  if (!whisperVersion) fixes.push("python -m pip install faster-whisper");
  if (models.length === 0)
    fixes.push('python -c "from faster_whisper import WhisperModel; WhisperModel(\'tiny\')"');
  return seamRow(
    "transcript",
    status,
    `${parts.map((p) => p.label).join("; ")}; drivers behind the B2.2 TranscriptProvider seam stay fake in tests (live runs = pass 3)`,
    fixes.join("  |  "),
  );
}

async function deploySeam() {
  const vercel = await probe("vercel", ["--version"]);
  const version = vercel.ok ? parseVercelVersion(vercel.output) : null;
  if (version) {
    return seamRow(
      "deploy",
      "live-ready",
      `Vercel CLI ${version} on PATH; DeployTarget driver still fake in pass 2 (real adapter = pass 3)`,
    );
  }
  return seamRow("deploy", "not-live-ready", "Vercel CLI not found on PATH", "npm i -g vercel");
}

function trendSeam() {
  return seamRow(
    "trend",
    "fake-only",
    "BY DESIGN in pass 2: TrendSource has only the deterministic fake driver; official-API pollers (YouTube Data API first) are pass-3 work — nothing to install",
  );
}

async function main() {
  // Executable ratchet: refuse to report from broken detection logic.
  selfCheck();

  const rows = [await renderSeam(), await transcriptSeam(), await deploySeam(), trendSeam()];
  const missing = rows.filter((r) => r.status === "not-live-ready").length;

  console.log("");
  console.log("thalon doctor — pass-3 toolchain readiness (B4.7; report, not a gate)");
  console.log(`repo: ${repoRoot}`);
  console.log("");
  console.log(renderTable(rows));
  console.log("");
  console.log(
    missing === 0
      ? "All seams report as expected for pass 2 (fakes stay in tests; live drivers land in pass 3)."
      : `${missing} seam(s) not live-ready — each row above carries its exact fix command.`,
  );
  console.log("");
}

main().catch((err) => {
  // Reserved non-zero path: doctor could not produce the report itself.
  console.error(`doctor failed to produce a report: ${err?.stack ?? err}`);
  process.exit(2);
});
