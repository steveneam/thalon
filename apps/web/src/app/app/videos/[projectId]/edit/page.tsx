import { VideoEditor } from "@/components/videos/editor";

/**
 * The video editor: the exact-mock rebuild of Videos.dc.html (DOCTRINE 0) —
 * the multi-track EDL surface with the agent as its front door. `?cut=`
 * picks the version; without one, the project's first cut opens.
 */
export default async function CutEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ cut?: string | string[] }>;
}) {
  const { projectId } = await params;
  const { cut } = await searchParams;
  return <VideoEditor projectId={projectId} cutId={typeof cut === "string" ? cut : null} />;
}
