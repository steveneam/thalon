import { CreateSurface, type CreateFamily } from "@/components/create/create-surface";

/** Reads the handoff params server-side (?prompt= from Trends/omnibox, ?keyword= from Search, ?family= from the omnibox heuristic). */
export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const family = first(params.family);
  return (
    <CreateSurface
      initialPrompt={first(params.prompt)}
      initialKeyword={first(params.keyword)}
      initialFamily={family === "post" || family === "video" || family === "page" ? (family as CreateFamily) : undefined}
    />
  );
}
