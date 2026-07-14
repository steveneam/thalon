import { ApproveQueue } from "@/components/approve/approve-queue";

/**
 * The approve queue inside the workspace shell (B6.2 restyle — the classic
 * 3-zone flow, test-pinned). ?run=/?draft= deep links are consumed by the
 * queue from the mount-time URL.
 */
export default function WorkspaceApprovePage() {
  return <ApproveQueue />;
}
