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
