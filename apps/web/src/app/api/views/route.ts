import { NextResponse } from "next/server";
import { z } from "zod";
import { isSavedViewSurface, SAVED_VIEW_SURFACES } from "@thalon/contracts";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * Saved views (Phase-I window, s61 — the tenant-wide views store; wired s62
 * by the W-audit storage-story pass): named view configs per surface, the
 * SERVER as system of record — a saved view survives the browser, the box,
 * and the operator's machine. The board/calendar tabs read this; localStorage
 * is only ever a one-time migration source on the client, never the record.
 */

const putSchema = z.object({
  surface: z.enum(SAVED_VIEW_SURFACES),
  name: z.string().min(1).max(80),
  config: z.record(z.string(), z.unknown()).default({}),
  position: z.number().int().min(0).optional(),
});

interface WireView {
  id: string;
  surface: string;
  name: string;
  config: Record<string, unknown>;
  position: number;
}

function toWire(row: {
  id: string;
  surface: string;
  name: string;
  config: unknown;
  position: number;
}): WireView {
  return {
    id: row.id,
    surface: row.surface,
    name: row.name,
    config: (row.config ?? {}) as Record<string, unknown>,
    position: row.position,
  };
}

/** A surface's views in tab order. */
export async function GET(request: Request) {
  const surface = new URL(request.url).searchParams.get("surface") ?? "";
  if (!isSavedViewSurface(surface)) {
    return NextResponse.json(
      { error: `Unknown surface — one of: ${SAVED_VIEW_SURFACES.join(", ")}.` },
      { status: 400 },
    );
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const rows = await repos.savedViews.list(ctx, surface);
    return NextResponse.json({ views: rows.map(toWire) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * Save-view snapshot: upsert by (surface, name) — "Save view" is idempotent,
 * so an existing name updates its config in place; a new name is created.
 * (Repo `create` fails loud on duplicates by design; the find-first here is
 * what makes the button re-pressable.)
 */
export async function PUT(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A surface, a view name, and a config object are required." },
      { status: 400 },
    );
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const { surface, name, config, position } = parsed.data;
    const existing = (await repos.savedViews.list(ctx, surface)).find((v) => v.name === name);
    const row = existing
      ? await repos.savedViews.update(ctx, existing.id, {
          config,
          ...(position !== undefined ? { position } : {}),
        })
      : await repos.savedViews.create(ctx, { surface, name, config, position: position ?? 0 });
    return NextResponse.json({ view: toWire(row) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
