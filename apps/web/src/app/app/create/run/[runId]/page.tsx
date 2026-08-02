import { ComposerSurface } from "@/components/composer/composer";

/**
 * The Composer route (B-create.4, create-engine spec §Surfaces item 4):
 * `/app/create/run/[runId]` — the run-scoped checkpoint between Generate and
 * Approve. The Approve queue's "Open in Composer" re-entry links here.
 */
export default async function ComposerPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return <ComposerSurface runId={runId} />;
}
