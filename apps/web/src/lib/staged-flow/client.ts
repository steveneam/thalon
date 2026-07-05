import { asJson } from "@/lib/approve-queue/client";
import type { Rfc6902Op } from "./patch";
import type { StagedEditKind, StagedFlowState } from "./types";

/**
 * Fetch seam for the staged-flow surface — the components' ONLY way to the
 * staged endpoints (MSW intercepts here in tests; the /api/staged routes
 * serve the fake driver in dev; pass 3 swaps the routes' internals for the
 * real staged pipeline without touching this file or the components).
 */

export async function fetchStagedFlow(draftId: string): Promise<StagedFlowState> {
  const res = await fetch(`/api/staged/${draftId}/flow`);
  return asJson<StagedFlowState>(res);
}

export async function pickCandidate(draftId: string, candidateId: string): Promise<StagedFlowState> {
  const res = await fetch(`/api/staged/${draftId}/pick`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ candidateId }),
  });
  return asJson<StagedFlowState>(res);
}

/**
 * THE capture call: one interaction, one verbatim RFC-6902 patch, one
 * edit_diff row. Everything the surface does to a stage artifact — beat
 * tweaks, reorders, accepts, presets, raw-md applies — funnels through here.
 */
export async function sendStagedEdit(
  draftId: string,
  kind: StagedEditKind,
  patch: Rfc6902Op[],
  note?: string,
): Promise<StagedFlowState> {
  const res = await fetch(`/api/staged/${draftId}/edit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, patch, ...(note === undefined ? {} : { note }) }),
  });
  return asJson<StagedFlowState>(res);
}

export async function advanceStage(draftId: string): Promise<StagedFlowState> {
  const res = await fetch(`/api/staged/${draftId}/advance`, { method: "POST" });
  return asJson<StagedFlowState>(res);
}
