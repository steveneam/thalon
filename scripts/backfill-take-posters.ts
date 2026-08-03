/**
 * backfill-take-posters.ts — the B-media.0 backfill door's missing HANDLE
 * (s96). `backfillTakePosters` shipped s77 so "the dossier lights up without
 * waiting for new mints", but no runner ever invoked it: every take on this
 * box still reads poster-pending, and the s95-verdicted frame thumbnails
 * (editor blocks · beats rail · takes strip) have nothing to draw. One pass
 * per project: ffprobe → one frame → 640w webp → content-addressed store →
 * `meta.posterRef`. Local ffmpeg only, 0 credits; idempotent by construction
 * (a take already carrying a readable poster is skipped before any
 * subprocess runs).
 *
 * Usage (from repo root):
 *   npx tsx scripts/backfill-take-posters.ts            # every project, every tenant
 *   npx tsx scripts/backfill-take-posters.ts --project <id>
 *
 * A project without `meta.mediaRoot` on this box is skipped out loud — no
 * root means no bytes to derive from, which is a fact, not a failure.
 */
// Relative imports on purpose: worktree lanes junction node_modules to the
// main checkout, so "@thalon/*" would resolve to main's copy — the relative
// path always runs THIS checkout's code.
import path from "node:path";
import { tenantCtx } from "../packages/contracts/src/index";
import { openDb } from "../packages/db/src/index";
import { backfillTakePosters } from "../packages/engine/src/index";
import { getObjectStore } from "../packages/platform/src/index";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function mediaRootOf(meta: unknown): string | null {
  const root =
    typeof meta === "object" && meta !== null
      ? (meta as { mediaRoot?: unknown }).mediaRoot
      : undefined;
  return typeof root === "string" && root.startsWith("/") ? root : null;
}

async function main(): Promise<void> {
  const only = arg("project");
  /*
   * THE STORE THE WEB APP READS, not the one this cwd implies. With
   * THALON_DATA_DIR unset the local store resolves `.data` against the
   * CURRENT directory — the web app's cwd is apps/web, a repo-root script's
   * is not, and the first run of this script proved it: 66 posters written
   * to a store no route reads, every one a 404 on the surface (rule 11 —
   * the constraint was ours, not the platform's). Pinning the default to
   * the app's own root makes both sides mean the same bytes.
   */
  if (!process.env.THALON_DATA_DIR && !process.env.OBJECT_STORE?.includes("s3")) {
    process.env.THALON_DATA_DIR = path.resolve(__dirname, "../apps/web/.data");
  }
  const handle = await openDb();
  const store = getObjectStore();
  const derivedAt = new Date().toISOString();
  let derived = 0;
  let pending = 0;
  try {
    const tenants = await handle.repos.tenants.list();
    for (const tenant of tenants) {
      const ctx = tenantCtx(tenant.id);
      const projects = await handle.repos.videoProjects.list(ctx);
      for (const project of projects) {
        if (only !== undefined && project.id !== only) continue;
        const mediaRoot = mediaRootOf(project.meta);
        if (mediaRoot === null) {
          console.log(`· ${tenant.slug}/${project.name}: no meta.mediaRoot on this box — skipped`);
          continue;
        }
        console.log(`= ${tenant.slug}/${project.name} (${project.id})`);
        const result = await backfillTakePosters(ctx, handle.repos, project.id, {
          store,
          mediaRoot,
          derivedAt,
          log: (line) => console.log(line),
        });
        derived += result.derived;
        pending += result.pending;
        console.log(
          `  → ${result.derived} derived · ${result.already} already on record · ${result.pending} pending`,
        );
      }
    }
  } finally {
    await handle.close();
  }
  console.log(`done: ${derived} poster(s) derived, ${pending} pending`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
