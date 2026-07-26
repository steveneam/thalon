/**
 * B-media.0 (s77) — THE POSTER BACKFILL DOOR. Derive `meta.posterRef` for the
 * takes that already exist (58 on the concept film alone), so the dossier
 * lights up without waiting for new mints.
 *
 *   npm run videos:posters -w @thalon/web -- --project "concept film" [--dry-run]
 *   npm run videos:posters -w @thalon/web -- --all
 *
 * IDEMPOTENT: a take already carrying a readable poster is skipped before any
 * subprocess runs, so re-running is a no-op and never a re-derive. A box
 * without ffmpeg/ffprobe reports every take as "poster pending" and exits 0 —
 * a missing binary is an honest state, not a failure (the derivation gate).
 *
 * Run from apps/web (the -w flag does this) with the dev server STOPPED when
 * the store is PGlite — it is single-process and this opens the same .data/pg.
 */
import { parseArgs } from "node:util";
import { tenantCtx } from "@thalon/contracts";
import { openDb } from "@thalon/db";
import { backfillTakePosters, type BackfillTakePostersResult } from "@thalon/engine";
import { getObjectStore, readEnv } from "@thalon/platform";
import { mediaRootOf } from "../src/lib/videos/media-root";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      project: { type: "string" },
      all: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
    },
  });
  if (!values.project && !values.all) {
    console.error('usage: --project "<project name>" | --all  [--dry-run]');
    return 1;
  }

  const handle = await openDb();
  try {
    const slug = readEnv().DEMO_TENANT_SLUG;
    const tenant = await handle.repos.tenants.getBySlug(slug);
    if (!tenant) {
      console.error(`tenant "${slug}" not seeded — POST /api/profiles first`);
      return 1;
    }
    const ctx = tenantCtx(tenant.id);

    const all = await handle.repos.videoProjects.list(ctx);
    const projects = values.all ? all : all.filter((p) => p.name === values.project);
    if (projects.length === 0) {
      console.error(
        values.all ? "no video projects for this tenant" : `no project named "${values.project}"`,
      );
      return 1;
    }

    const store = getObjectStore();
    const derivedAt = new Date().toISOString();
    const totals: BackfillTakePostersResult = { derived: 0, already: 0, pending: 0, takes: [] };

    for (const project of projects) {
      const mediaRoot = mediaRootOf(project.meta);
      console.log(`\n${project.name} (${project.id})`);
      if (!mediaRoot) {
        // The same honest refusal the render route gives: this box does not
        // hold the project's media, so there is nothing to derive FROM.
        console.log("  · no meta.mediaRoot on this box — nothing to derive from");
        continue;
      }
      console.log(`  media root: ${mediaRoot}`);

      if (values["dry-run"]) {
        const takes = await handle.repos.videoTakes.list(ctx, project.id);
        for (const take of takes) console.log(`  ? ${take.ref} (${take.kind})`);
        console.log(`  dry run: ${takes.length} take(s) would be considered`);
        continue;
      }

      const result = await backfillTakePosters(ctx, handle.repos, project.id, {
        mediaRoot,
        store,
        derivedAt,
        log: (line) => console.log(line),
      });
      totals.derived += result.derived;
      totals.already += result.already;
      totals.pending += result.pending;
      console.log(
        `  → ${result.derived} derived · ${result.already} already on record · ${result.pending} pending`,
      );
    }

    if (!values["dry-run"]) {
      console.log(
        `\ntotal: ${totals.derived} derived · ${totals.already} already · ${totals.pending} pending`,
      );
    }
    return 0;
  } finally {
    await handle.close();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
