/**
 * B-audio.1 (s77) — THE BED DOOR. Point a video project at its
 * operator-licensed music bed: the bytes land in our content-addressed store
 * (`media/<sha256>.<ext>`, the same lane the workspace media door serves) and
 * the project records the ref WITH the licence that permits it.
 *
 *   npm run videos:bed -w @thalon/web -- \
 *     --project "concept film" --file /abs/path/to/bed.mp3 \
 *     --license "CC0 1.0" --source "freesound.org/s/12345" \
 *     --attested-by steven [--note "…"] [--alt "warm piano bed"]
 *
 * LICENSING IS ATTESTED, NEVER ASSUMED — the door refuses a bed that arrives
 * without the operator stating, on the record, what right they have to use
 * it. That is the launch gate made executable rather than remembered.
 *
 * NO MUSIC BED LIVES IN-TREE (founder-ratified, `render/narration.ts:34-36`):
 * the file this reads is operator data on the box, never a repo path.
 *
 * Run from apps/web (the -w flag does this) with the dev server STOPPED when
 * the store is PGlite — it is single-process and this opens the same .data/pg.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { MEDIA_AUDIO_EXTS, tenantCtx, type MediaAudioExt } from "@thalon/contracts";
import { openDb } from "@thalon/db";
import { configureProjectAudioBed } from "@thalon/engine";
import { getObjectStore, readEnv } from "@thalon/platform";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      project: { type: "string" },
      file: { type: "string" },
      license: { type: "string" },
      source: { type: "string" },
      "attested-by": { type: "string" },
      note: { type: "string" },
      alt: { type: "string" },
    },
  });
  if (
    !values.project ||
    !values.file ||
    !path.isAbsolute(values.file) ||
    !values.license ||
    !values.source ||
    !values["attested-by"]
  ) {
    console.error(
      'usage: --project "<name>" --file <absolute path> --license "<licence>" ' +
        '--source "<where it came from>" --attested-by <who> [--note "…"] [--alt "…"]',
    );
    return 1;
  }

  const ext = path.extname(values.file).slice(1).toLowerCase();
  if (!(MEDIA_AUDIO_EXTS as readonly string[]).includes(ext)) {
    console.error(`"${ext}" is not an audio extension the contract knows (${MEDIA_AUDIO_EXTS.join(", ")})`);
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
    const project = (await handle.repos.videoProjects.list(ctx)).find(
      (p) => p.name === values.project,
    );
    if (!project) {
      console.error(`no project named "${values.project}"`);
      return 1;
    }

    const stored = await configureProjectAudioBed(
      ctx,
      handle.repos,
      project.id,
      getObjectStore(),
      {
        bytes: await readFile(values.file),
        ext: ext as MediaAudioExt,
        storedAt: new Date().toISOString(),
        ...(values.alt ? { alt: values.alt } : {}),
        license: {
          license: values.license,
          source: values.source,
          attestedBy: values["attested-by"],
          attestedAt: new Date().toISOString(),
          ...(values.note ? { note: values.note } : {}),
        },
      },
    );

    console.log(
      `${project.name}: bed ${stored.key}` +
        `${stored.storedNow ? "" : " (bytes already stored)"} · licensed "${values.license}" from ${values.source}`,
    );
    return 0;
  } finally {
    await handle.close();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
