/**
 * B-ve.2 project import: register a local video-project tree (the reference
 * shape: stills/ + motion/ with keepers|rejects, cuts/, music-candidates/,
 * checkpoints/) as a video_projects row with its takes and cuts, writing
 * ONLY through the frozen B-ve.1 repos — the same doors the engine uses.
 *
 *   npm run videos:import -w @thalon/web -- \
 *     --root /abs/path/to/project --name "my film" \
 *     [--description "…"] [--reasons reasons.json] [--provenance prov.json] \
 *     [--cuts cuts.json] [--exclude experiments]… [--default-reason "…"] \
 *     [--allow-missing-reasons] [--dry-run] [--no-posters]
 *
 * Sidecars are ref-keyed JSON (operator/box data, never committed):
 *   reasons.json     { "<ref>": "why rejected", … }
 *   prov.json        { "<ref>": { model, pinned, … }, … }
 *   cuts.json        [ { name, version, edl: <path|object>, outputRef? }, … ]
 *
 * Run from apps/web (the -w flag does this) with the dev server STOPPED —
 * PGlite is single-process and this opens the same .data/pg the server uses.
 *
 * ── STAGING / ANY DEPLOYED BOX: the `-w` invocation above CANNOT WORK ────────
 * Do not try to run this "from the deployed web workdir". The web image is a
 * pruned Next standalone bundle: this script ships inside it, but there is no
 * root `package.json` and `@thalon/contracts` / `@thalon/engine` /
 * `@thalon/platform` do not exist anywhere in the image, so the file is an
 * orphan with unresolvable imports. It fails on the first import, not on the
 * database.
 *
 * What works (proven twice on staging by swordfish, 2026-07-19 and re-verified
 * 2026-07-29): a SOURCE checkout + `npm ci` in a one-off container built off
 * the same image tag, with the data volume and the app network attached, and
 * `DATABASE_URL` taken from the running app's own env. Pin the checkout to the
 * DEPLOYED commit so the script and the repos match the live schema.
 *
 * Two footguns found doing it for real:
 *   · sidecar paths (--reasons/--provenance/--cuts) resolve against CWD, NOT
 *     --root. Pass them absolute.
 *   · re-running is NOT free on a populated tenant: this writes video_projects
 *     /takes/cuts, so a second pass risks a duplicate project. Use --dry-run
 *     first; it plans without writing.
 * A reject without a reason is refused by the contract; this script surfaces
 * every such ref and exits non-zero rather than importing a hole in the
 * learning material (--allow-missing-reasons imports the rest anyway).
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { tenantCtx, type VideoCutInput, type VideoCutStatus } from "@thalon/contracts";
import { openDb } from "@thalon/db";
import { backfillTakePosters } from "@thalon/engine";
import { getObjectStore, readEnv } from "@thalon/platform";
import { classifyProjectTree } from "../src/lib/videos/import";

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

interface CutManifestEntry {
  name: string;
  version: number;
  edl: string | Record<string, unknown>;
  outputRef?: string;
  /** B-ve.5: derived-cut provenance — parent named by (name, version), resolved to its row id here. */
  lineage?: { parent: { name: string; version: number }; aspect: string };
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      root: { type: "string" },
      name: { type: "string" },
      description: { type: "string" },
      reasons: { type: "string" },
      provenance: { type: "string" },
      cuts: { type: "string" },
      exclude: { type: "string", multiple: true },
      "default-reason": { type: "string" },
      "allow-missing-reasons": { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      "no-posters": { type: "boolean", default: false },
    },
  });
  if (!values.root || !path.isAbsolute(values.root) || !values.name) {
    console.error("usage: --root <absolute path> --name <project name> [see script header]");
    return 1;
  }

  const entries = await readdir(values.root, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => path.relative(values.root!, path.join(e.parentPath, e.name)));

  const plan = classifyProjectTree(files, {
    reasons: values.reasons ? await readJson(values.reasons) : undefined,
    provenance: values.provenance ? await readJson(values.provenance) : undefined,
    exclude: values.exclude,
    defaultReason: values["default-reason"],
  });

  console.log(`plan: ${plan.takes.length} takes (${plan.skipped.length} skipped)`);
  for (const s of plan.skipped) console.log(`  skip ${s.ref} — ${s.why}`);
  if (plan.missingReasons.length > 0) {
    console.error(`\n${plan.missingReasons.length} reject(s) have NO reason on record:`);
    for (const ref of plan.missingReasons) console.error(`  ${ref}`);
    console.error("add them to --reasons (or pass --default-reason / --allow-missing-reasons)");
    if (!values["allow-missing-reasons"]) return 1;
  }
  if (values["dry-run"]) return 0;

  const cutsManifest = values.cuts ? await readJson<CutManifestEntry[]>(values.cuts) : [];
  const handle = await openDb();
  try {
    const slug = readEnv().DEMO_TENANT_SLUG;
    const tenant = await handle.repos.tenants.getBySlug(slug);
    if (!tenant) {
      console.error(`tenant "${slug}" not seeded — POST /api/profiles first`);
      return 1;
    }
    const ctx = tenantCtx(tenant.id);

    const { project, created } = await handle.repos.videoProjects.create(ctx, {
      name: values.name,
      description: values.description,
      meta: { mediaRoot: values.root },
    });
    console.log(`project "${project.name}" ${created ? "created" : "exists"} (${project.id})`);
    const existingRoot = (project.meta as { mediaRoot?: string }).mediaRoot;
    if (!created && existingRoot !== values.root) {
      console.warn(
        `WARNING: existing mediaRoot "${existingRoot}" differs from --root — the frozen window has no meta-update door; playback follows the stored root`,
      );
    }

    let takesCreated = 0;
    let replayed = 0;
    let redisposed = 0;
    for (const input of plan.takes) {
      const { take, created: fresh } = await handle.repos.videoTakes.record(ctx, project.id, input);
      if (fresh) takesCreated += 1;
      else if (take.disposition !== input.disposition) {
        await handle.repos.videoTakes.setDisposition(
          ctx,
          take.id,
          input.disposition ?? "keeper",
          input.reason,
        );
        redisposed += 1;
      } else replayed += 1;
    }
    console.log(`takes: ${takesCreated} created · ${replayed} replayed · ${redisposed} re-disposed`);

    // B-media.0 write moment 2: the bytes have just landed, so derive the
    // posters HERE rather than leaving the dossier blank until someone
    // remembers the backfill. Idempotent (a take with a poster is skipped) and
    // gated (no ffmpeg on this box = "poster pending", never a failed import).
    if (!values["no-posters"]) {
      const posters = await backfillTakePosters(ctx, handle.repos, project.id, {
        mediaRoot: values.root,
        store: getObjectStore(),
        derivedAt: new Date().toISOString(),
      });
      console.log(
        `posters: ${posters.derived} derived · ${posters.already} already on record · ${posters.pending} pending`,
      );
    }

    for (const entry of cutsManifest) {
      const edl =
        typeof entry.edl === "string"
          ? await readJson<Record<string, unknown>>(path.resolve(path.dirname(values.cuts!), entry.edl))
          : entry.edl;
      // The repo re-parses through videoCutInputSchema — the cast is type-level only.
      const { cut, created: fresh } = await handle.repos.videoCuts.create(ctx, project.id, {
        name: entry.name,
        version: entry.version,
        edl,
      } as VideoCutInput);
      let status = cut.status as VideoCutStatus;
      if (entry.outputRef && status === "draft") {
        await handle.repos.videoCuts.recordRender(ctx, cut.id, entry.outputRef);
        status = "rendered";
      }
      console.log(`cut ${entry.name} v${entry.version}: ${fresh ? "created" : "exists"} (${status})`);
    }

    // B-ve.5 lineage backfill: stamp meta.lineage on manifest cuts that
    // declare a parent (the pre-derive-door masters). stampLineage is
    // one-way + idempotent — a replay is a silent no-op, a CONFLICTING
    // stamp fails the import loudly.
    const withLineage = cutsManifest.filter((e) => e.lineage);
    if (withLineage.length > 0) {
      const allCuts = await handle.repos.videoCuts.list(ctx, project.id);
      const byNameVersion = (name: string, version: number) =>
        allCuts.find((c) => c.name === name && c.version === version) ?? null;
      for (const entry of withLineage) {
        const row = byNameVersion(entry.name, entry.version);
        const parent = byNameVersion(entry.lineage!.parent.name, entry.lineage!.parent.version);
        if (!row || !parent) {
          console.error(
            `lineage for ${entry.name} v${entry.version}: ${!row ? "cut" : `parent ${entry.lineage!.parent.name} v${entry.lineage!.parent.version}`} not found`,
          );
          return 1;
        }
        const { stamped } = await handle.repos.videoCuts.stampLineage(ctx, row.id, {
          parentCutId: parent.id,
          aspect: entry.lineage!.aspect,
        });
        console.log(
          `lineage ${entry.name} v${entry.version} ← ${parent.name} v${parent.version} (${entry.lineage!.aspect}): ${stamped ? "stamped" : "already on record"}`,
        );
      }
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
