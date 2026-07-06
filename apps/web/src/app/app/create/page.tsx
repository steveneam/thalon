import { CreateSurface } from "@/components/create/create-surface";

/** Reads Intel's handoff params server-side (?prompt= from Trends, ?keyword= from Search). */
export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return <CreateSurface initialPrompt={first(params.prompt)} initialKeyword={first(params.keyword)} />;
}
