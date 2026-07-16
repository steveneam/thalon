import { ProjectBrowser } from "@/components/videos/project-browser";

export default async function VideoProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectBrowser projectId={projectId} />;
}
