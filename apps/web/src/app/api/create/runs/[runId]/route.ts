import { createChildRefsSchema } from "@thalon/contracts";
import type { Draft } from "@thalon/db";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * The Composer's run-scoped read (B-create.4, spec §Flow): one create run +
 * every draft its children produced, joined server-side so the surface opens
 * on one round trip. Children are the run's own `{kind, id, error?}` refs —
 * a `fanout_run` child contributes its drafts, a `draft` child contributes
 * itself, a `video_project` child belongs to the video arc's own surfaces
 * and rides through as a ref only. A child that recorded a dispatch error is
 * returned AS the error it recorded (spec Error Behavior: a partial run is a
 * real state) — the surface writes it in words on that platform's tab.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });

  try {
    // The id may be the create run's own, or a CHILD's (the Approve re-entry
    // knows only the draft's fanout run) — resolved here over the existing
    // list read, because `create_runs` deliberately has no by-child lookup
    // verb (edit.ts's own note) and the windows stay frozen.
    let run = await repos.createRuns.get(ctx, runId);
    if (!run) {
      const all = await repos.createRuns.list(ctx);
      run =
        all.find((r) => {
          const refs = createChildRefsSchema.safeParse(r.children);
          return refs.success && refs.data.some((c) => c.id === runId);
        }) ?? null;
    }
    if (!run) {
      return NextResponse.json(
        { error: "no create run records this id — the run predates Create or was a plain fan-out" },
        { status: 404 },
      );
    }

    // Trust nothing out of jsonb — malformed refs surface as an empty list,
    // never a crash (the CreateRunWire children discipline, server-side).
    const children = createChildRefsSchema.safeParse(run.children);
    const drafts: Draft[] = [];
    for (const child of children.success ? children.data : []) {
      if (child.error) continue;
      if (child.kind === "fanout_run") {
        drafts.push(...(await repos.drafts.listByRun(ctx, child.id)));
      } else if (child.kind === "draft") {
        drafts.push(await repos.drafts.get(ctx, child.id));
      }
    }
    return NextResponse.json({ run, drafts });
  } catch (err) {
    return toErrorResponse(err);
  }
}
