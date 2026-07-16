import { CutEditor } from "@/components/videos/cut-editor";

/** B-ve.3: the dedicated editor route — the detail page stays the browse surface. */
export default async function CutEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ cut?: string | string[] }>;
}) {
  const { projectId } = await params;
  const { cut } = await searchParams;
  return <CutEditor projectId={projectId} cutId={typeof cut === "string" ? cut : null} />;
}
