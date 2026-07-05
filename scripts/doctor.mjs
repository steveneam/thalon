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
 * Remotion which is an engine devDependency):
 *   render     — Remotion + @remotion/cli resolvable from this repo.
 *                Licence stance (recorded here per CHARTER A6/A10): the
 *                Remotion company licence is FREE for companies of up to 3
 *                people, including for-profit use — a GROWTH gate to revisit
 *                when the team grows, not a launch gate. Swap path lives
 *                behind the RenderTarget seam.
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
  parseBareVersion,
  parseFfmpegVersion,
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
function probe(cmd, args) {
  return new Promise((resolve) => {
    let child;
    try {
      child =
        process.platform === "win32"
          ? spawn([cmd, ...args].join(" "), { shell: true, windowsHide: true })
          : spawn(cmd, args, { windowsHide: true });
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

const REMOTION_LICENCE_NOTE =
  "licence: free for companies of <=3 people incl. for-profit — GROWTH gate (revisit when the team grows), not a launch gate (CHARTER A6/A10)";

async function renderSeam() {
  const remotion = installedPackageVersion("remotion");
  const cli = installedPackageVersion("@remotion/cli");
  const status = readiness([{ ok: !!remotion }, { ok: !!cli }]);
  if (status === "live-ready") {
    return seamRow(
      "render",
      "live-ready",
      `remotion ${remotion} + @remotion/cli ${cli} installed; driver still fake in pass 2 (real composition = pass 3); ${REMOTION_LICENCE_NOTE}`,
    );
  }
  return seamRow(
    "render",
    "not-live-ready",
    `remotion ${remotion ?? "MISSING"}, @remotion/cli ${cli ?? "MISSING"}; ${REMOTION_LICENCE_NOTE}`,
    "npm install --save-dev remotion @remotion/cli --workspace @thalon/engine (run from the repo root)",
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
