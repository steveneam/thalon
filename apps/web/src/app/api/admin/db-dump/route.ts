import path from "node:path";
import { readEnv } from "@thalon/platform";
import { NextResponse } from "next/server";
import { timingSafeEqualString } from "@/lib/auth/gate";
import { getDbHandle } from "@/lib/repos";

/**
 * B6.7 backup hook (ADR 0007 decision 5): the box's `pre-backup.d` calls
 * this before its snapshot; the app — the ONE process that owns the
 * embedded database — writes a consistent gzip dump INSIDE the data volume
 * (`<THALON_DATA_DIR>/backups/pglite-dump.tar.gz`), so the snapshot that
 * follows picks it up while the raw live-DB files stay excluded
 * (dump-before-snapshot invariant). Bearer-token gated, FAIL CLOSED when
 * unconfigured; the workspace basic-auth proxy exempts exactly this path
 * because this gate is the stronger, machine-to-machine one. One dump file,
 * overwritten each call — history lives in the box's snapshots, not on disk.
 */

/** Serialize concurrent calls — two dumps racing the same temp file would corrupt the export. */
let inFlight: Promise<{ bytes: number }> | null = null;

export async function POST(request: Request) {
  const env = readEnv();
  if (!env.DB_DUMP_TOKEN) {
    return new NextResponse("db-dump is not configured (DB_DUMP_TOKEN) — failing closed.", {
      status: 503,
    });
  }
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match || !timingSafeEqualString(match[1], env.DB_DUMP_TOKEN)) {
    return new NextResponse("Unauthorized.", { status: 401 });
  }

  const target = path.resolve(env.THALON_DATA_DIR, "backups", "pglite-dump.tar.gz");
  const startedMs = Date.now();
  try {
    if (!inFlight) {
      inFlight = getDbHandle()
        .then((handle) => handle.dumpTo(target))
        .finally(() => {
          inFlight = null;
        });
    }
    const { bytes } = await inFlight;
    return NextResponse.json({ path: target, bytes, ms: Date.now() - startedMs });
  } catch (err) {
    // A failed dump must be LOUD — the box's pre-backup step treats non-200
    // as "do not snapshot a stale dump silently".
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "dump failed" },
      { status: 500 },
    );
  }
}
