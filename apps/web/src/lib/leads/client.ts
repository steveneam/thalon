import type { CreateFamily } from "@/lib/intel/types";
import { asJson } from "@/lib/approve-queue/client";
import type {
  ImportReport,
  LeadsPayload,
  ScoringReport,
  SyncReport,
  TriageAction,
  TriageResult,
} from "./types";

export async function fetchLeads(): Promise<LeadsPayload> {
  return asJson<LeadsPayload>(await fetch("/api/leads"));
}

export async function importLeadsCsv(
  csv: string,
): Promise<{ report: ImportReport; scoring: ScoringReport }> {
  const res = await fetch("/api/leads/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csv }),
  });
  return asJson(res);
}

export async function syncWaitlist(): Promise<{ sync: SyncReport; scoring: ScoringReport }> {
  return asJson(await fetch("/api/leads/sync-waitlist", { method: "POST" }));
}

/** Gateway refusals (budget, key) surface verbatim as the thrown message — the sweep convention. */
export async function scoreLeadsNow(): Promise<ScoringReport> {
  return asJson(await fetch("/api/leads/score", { method: "POST" }));
}

export async function triageLeads(action: TriageAction, ids: string[]): Promise<TriageResult> {
  const res = await fetch("/api/leads/triage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ids }),
  });
  return asJson(res);
}

export async function promoteLeadTo(
  id: string,
  family: CreateFamily,
): Promise<{ createHref: string }> {
  const res = await fetch("/api/leads/promote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, family }),
  });
  return asJson(res);
}
