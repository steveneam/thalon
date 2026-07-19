import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * CLI-side env bootstrap. Next.js auto-loads `apps/web/.env.local` only
 * inside its own process; these eval CLIs run at the repo root, so mirror
 * the same file into process.env here (a value already present in the
 * environment always wins — this only fills gaps, never overrides).
 * Reading process.env directly is allowed in eval/** — the boundary ratchet
 * (tests/boundary.test.ts) scopes the env rule to packages/ + proprietary/.
 */
export function loadEnvLocal(): void {
  const envPath = fileURLToPath(new URL("../../apps/web/.env.local", import.meta.url));
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(rawLine.trim());
    if (!match) continue;
    const [, key, value] = match;
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/**
 * `next dev` runs with cwd `apps/web`, so its default THALON_DATA_DIR
 * `.data` resolves to `apps/web/.data`. Point root-run CLIs at the same
 * directory so the dogfood run and the approve-queue UI share one dev DB.
 */
export function useWebAppDataDir(): void {
  process.env.THALON_DATA_DIR ??= fileURLToPath(new URL("../../apps/web/.data", import.meta.url));
}

/**
 * PGlite is single-process: if the dev server holds the shared dev DB open,
 * a CLI opening the same data dir sees stale state (the server's unflushed
 * writes are invisible) and two concurrent writers can corrupt the dir —
 * found live during the B1.5 dogfood when an operator edit made through the
 * running server never became visible to the CLI. One process at a time:
 * refuse to open the shared dev DB while the web app is serving it.
 * (Checks the dev lane port 3111 — the port pinned in apps/web's `dev`
 * script; override PORT setups must stop the server themselves.)
 *
 * Postgres (`DATABASE_URL` set — the platform's db selection) is
 * multi-writer by design: the dev server and a CLI share it safely, so the
 * single-process rule applies to the PGlite path only. Call loadEnvLocal()
 * first so the check sees the same DATABASE_URL the app runs with.
 */
export async function assertSoleDbWriter(): Promise<void> {
  if (process.env.DATABASE_URL) return;
  let devServerUp = false;
  try {
    const res = await fetch("http://localhost:3111/api/health", {
      signal: AbortSignal.timeout(1500),
    });
    devServerUp = res.ok;
  } catch {
    // Connection refused / timeout: no dev server — safe to proceed.
  }
  if (devServerUp) {
    throw new Error(
      "the dev server is running and holds the dev database open — stop `npm run dev` before running this CLI (PGlite allows one process at a time)",
    );
  }
}
