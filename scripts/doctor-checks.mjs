/**
 * Pure helpers for `npm run doctor` (B4.7). No I/O in this module — every
 * function maps strings in to strings/objects out, cheap enough that
 * doctor.mjs re-asserts all of them via selfCheck() on EVERY run (an
 * executable ratchet: a broken parser can never silently produce a wrong
 * readiness report — doctor refuses to report instead).
 */

/** "ffmpeg version 7.1.1-essentials_build-www.gyan.dev ..." -> "7.1.1-essentials_build-www.gyan.dev" */
export function parseFfmpegVersion(output) {
  const match = /^ffmpeg version (\S+)/m.exec(output ?? "");
  return match ? match[1] : null;
}

/** "Vercel CLI 54.11.1" (any surrounding noise tolerated) -> "54.11.1" */
export function parseVercelVersion(output) {
  const match = /Vercel CLI (\d+\.\d+\.\d+\S*)/.exec(output ?? "");
  return match ? match[1] : null;
}

/** "Python 3.10.11" -> "3.10.11" */
export function parsePythonVersion(output) {
  const match = /Python (\d+\.\d+\.\d+\S*)/.exec(output ?? "");
  return match ? match[1] : null;
}

/** faster-whisper prints a bare version ("1.1.1") from the import probe; reject anything that isn't one. */
export function parseBareVersion(output) {
  const match = /^\s*(\d+\.\d+(?:\.\d+)?\S*)\s*$/.exec(output ?? "");
  return match ? match[1] : null;
}

/**
 * HuggingFace hub cache entry names -> installed Whisper model names.
 * ["models--Systran--faster-whisper-tiny", "models--foo--bar"] -> ["Systran/faster-whisper-tiny"]
 */
export function whisperModelsFrom(entryNames) {
  return (entryNames ?? [])
    .filter((n) => /^models--/.test(n) && /whisper/i.test(n))
    .map((n) => n.replace(/^models--/, "").split("--").join("/"))
    .sort();
}

/**
 * One seam row for the report. `status` is the honest tri-state the charter
 * asks for: "live-ready" (toolchain present for the pass-3 driver),
 * "fake-only" (by design this pass), "not-live-ready" (a tool is missing —
 * `fix` carries the exact install command).
 */
export function seamRow(seam, status, detail, fix = "") {
  return { seam, status, detail, fix };
}

/** Aggregates check outcomes: all present -> live-ready, else not-live-ready. */
export function readiness(parts) {
  return parts.every((p) => p.ok) ? "live-ready" : "not-live-ready";
}

/** Renders the seam rows as a plain fixed-width table (no deps, no color). */
export function renderTable(rows) {
  const headers = { seam: "SEAM", status: "STATUS", detail: "DETAIL" };
  const all = [headers, ...rows];
  const w = (key) => Math.max(...all.map((r) => String(r[key]).length));
  const wSeam = w("seam");
  const wStatus = w("status");
  const line = (r) =>
    `  ${String(r.seam).padEnd(wSeam)}  ${String(r.status).padEnd(wStatus)}  ${r.detail}`;
  const out = [line(headers), `  ${"-".repeat(wSeam)}  ${"-".repeat(wStatus)}  ${"-".repeat(6)}`];
  for (const row of rows) {
    out.push(line(row));
    if (row.fix) out.push(`  ${" ".repeat(wSeam)}  ${" ".repeat(wStatus)}  fix: ${row.fix}`);
  }
  return out.join("\n");
}

/**
 * Executable ratchet: doctor.mjs calls this before producing any report and
 * exits non-zero if a parser regressed — a readiness report built on broken
 * detection is worse than no report.
 */
export function selfCheck() {
  const fail = (what) => {
    throw new Error(`doctor self-check failed: ${what}`);
  };
  if (parseFfmpegVersion("ffmpeg version 7.1.1-essentials_build-www.gyan.dev Copyright") !==
      "7.1.1-essentials_build-www.gyan.dev") fail("parseFfmpegVersion");
  if (parseFfmpegVersion("command not found") !== null) fail("parseFfmpegVersion(miss)");
  if (parseVercelVersion("Vercel CLI 54.11.1\n54.11.1") !== "54.11.1") fail("parseVercelVersion");
  if (parseVercelVersion("") !== null) fail("parseVercelVersion(miss)");
  if (parsePythonVersion("Python 3.10.11") !== "3.10.11") fail("parsePythonVersion");
  if (parseBareVersion(" 1.1.1\n") !== "1.1.1") fail("parseBareVersion");
  if (parseBareVersion("Traceback (most recent call last):") !== null) fail("parseBareVersion(miss)");
  const models = whisperModelsFrom(["models--Systran--faster-whisper-tiny", "models--acme--other"]);
  if (models.length !== 1 || models[0] !== "Systran/faster-whisper-tiny") fail("whisperModelsFrom");
  if (readiness([{ ok: true }, { ok: true }]) !== "live-ready") fail("readiness(ready)");
  if (readiness([{ ok: true }, { ok: false }]) !== "not-live-ready") fail("readiness(missing)");
  if (!renderTable([seamRow("render", "live-ready", "x")]).includes("live-ready")) fail("renderTable");
}
