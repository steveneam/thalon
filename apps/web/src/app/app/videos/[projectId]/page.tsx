import { VideoDossier } from "@/components/videos/dossier";

/**
 * One video project: the exact-mock rebuild of Video Dossier.dc.html
 * (DOCTRINE 0) — the family behind one card, with the project record read
 * client-side through the existing videos client.
 */
export default async function VideoProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ open?: string }>;
}) {
  const { projectId } = await params;
  // ?open=takes|cuts — the overview's takes/cuts facts deep-link to their
  // evidence instead of landing at the top (s99: every fact is a door).
  const { open } = await searchParams;
  return (
    <VideoDossier
      projectId={projectId}
      initialOpen={open === "takes" || open === "cuts" ? open : null}
    />
  );
}
