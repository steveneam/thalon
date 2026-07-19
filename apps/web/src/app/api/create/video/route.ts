import { InvalidStateError } from "@thalon/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { generateOnePromptVideo } from "@/lib/videos/one-prompt";

const requestSchema = z.object({
  prompt: z.string().min(1),
  sourceUrl: z.string().min(1).optional(),
});

/**
 * The one-prompt video door (B-vid.7): Create brief → the engine's
 * `runOnePromptVideo` — staged drafts judged between stages, then the video
 * project (takes plan + draft cut) staged through the frozen repos. Thin
 * per doctrine (SPINE §80): authorize → service → serialize. NOTHING on
 * this path renders or mints — the cut lands "draft"; render stays behind
 * the existing armed doors.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Send { prompt, sourceUrl? }." }, { status: 400 });
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    return NextResponse.json(await generateOnePromptVideo(ctx, repos, parsed.data));
  } catch (err) {
    // A halted flow (empty brief after trim, a foreign project-name origin)
    // is a state refusal, not a validation slip — 409, message verbatim.
    if (err instanceof InvalidStateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return toErrorResponse(err);
  }
}
