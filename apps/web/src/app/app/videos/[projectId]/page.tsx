import { VideoDossier } from "@/components/videos/dossier";

/**
 * One video project: the exact-mock rebuild of Video Dossier.dc.html
 * (DOCTRINE 0) — the family behind one card, with the project record read
 * client-side through the existing videos client.
 */
export default async function VideoProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <VideoDossier projectId={projectId} />;
}
