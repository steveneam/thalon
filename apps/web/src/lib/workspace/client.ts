import { asJson } from "@/lib/approve-queue/client";
import type { PlanPayload, WorkspacePulse, WorkspaceStatus } from "./types";

export async function fetchPulse(): Promise<WorkspacePulse> {
  return asJson<WorkspacePulse>(await fetch("/api/app/pulse"));
}

export async function fetchStatus(): Promise<WorkspaceStatus> {
  return asJson<WorkspaceStatus>(await fetch("/api/app/status"));
}

export async function fetchPlan(): Promise<PlanPayload> {
  return asJson<PlanPayload>(await fetch("/api/app/plan"));
}

export interface WireSlot {
  draftId: string;
  scheduledFor: string;
  note: string | null;
}

/**
 * Plan or re-plan a draft's slot (s78 — the calendar's write door). Upsert by
 * (tenant, draft) server-side, so this is both "plan" and "reschedule". A
 * slot is an intention: writing one publishes nothing and arms nothing.
 */
export async function planSlot(input: {
  draftId: string;
  scheduledFor: string;
  note?: string;
}): Promise<WireSlot> {
  const { slot } = await asJson<{ slot: WireSlot }>(
    await fetch("/api/calendar/slots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return slot;
}

/** Remove a draft's plan. A draft with no slot answers 404 — never a quiet success. */
export async function removeSlot(draftId: string): Promise<void> {
  await asJson<{ removed: string }>(
    await fetch(`/api/calendar/slots?draftId=${encodeURIComponent(draftId)}`, {
      method: "DELETE",
    }),
  );
}
