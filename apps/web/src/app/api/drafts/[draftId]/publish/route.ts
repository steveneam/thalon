import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { publishApprovedPage } from "@/lib/approve-queue/actions";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * B6.7: publish an APPROVED `web_page` draft to the own site (the B6.6
 * engine door). Revalidate-on-publish lives here: the blog index and feeds
 * render per request (runtime data on a long-lived server), so the one
 * truly cached surface is the on-demand-rendered `/blog/[slug]` page — a
 * republish of the same slug would serve stale bytes without the
 * `revalidatePath` below.
 */
export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  const body: unknown = await request.json().catch(() => ({}));
  const rawTags =
    typeof body === "object" && body !== null ? (body as { tags?: unknown }).tags : undefined;
  const tags =
    Array.isArray(rawTags) && rawTags.every((tag): tag is string => typeof tag === "string" && tag.length > 0)
      ? rawTags
      : undefined;
  try {
    const result = await publishApprovedPage(repos, ctx, draftId, Date.now(), tags);
    if (result.status === "failed") {
      // Recorded on the draft (deployStatus:"failed") by the engine — surface it loudly, never as a 200.
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    revalidatePath(`/blog/${result.slug}`);
    return NextResponse.json({ slug: result.slug, url: result.url, draft: result.draft });
  } catch (err) {
    return toErrorResponse(err);
  }
}
