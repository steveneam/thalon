import { CreateContextLoader } from "@/components/create/create-context-loader";
import { CreateSurface, type CreateFamily } from "@/components/create/create-surface";

/**
 * Reads the handoff params server-side: ?ctx= (the wave-3 capture-id context
 * spine from Intel's exits — resolved CLIENT-side through the context route,
 * because route handlers and server components bundle in separate layers and
 * only the route layer shares the fake-driver store with the writers), plus
 * the legacy doors — ?prompt= (omnibox), ?keyword= (old Search deep links),
 * ?family= (omnibox heuristic).
 */
export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const familyParam = first(params.family);
  const family =
    familyParam === "post" || familyParam === "video" || familyParam === "page"
      ? (familyParam as CreateFamily)
      : undefined;
  const ctxId = first(params.ctx);
  const common = {
    initialPrompt: first(params.prompt),
    initialKeyword: first(params.keyword),
    initialFamily: family,
  };
  return ctxId ? (
    <CreateContextLoader contextId={ctxId} {...common} />
  ) : (
    <CreateSurface {...common} context={null} />
  );
}
