import { ApproveSurface } from "@/components/approve/approve-surface";

/**
 * The Approve surface inside the workspace shell — rebuilt exactly from
 * `docs/research/mock-sheets/Approve.dc.html` (DOCTRINE 0). ?run=/?draft=
 * deep links are consumed by the surface from the mount-time URL.
 */
export default function WorkspaceApprovePage() {
  return <ApproveSurface />;
}
