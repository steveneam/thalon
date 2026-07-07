import type { MonitoredAreaConfig, MonitoredAreaStatus, SearchTargetStatus } from "@thalon/contracts";
import { asJson } from "@/lib/approve-queue/client";
import type {
  AreaRow,
  CreateContext,
  CreateFamily,
  HorizonPayload,
  IntelCapture,
  TargetRow,
  TrendsPayload,
} from "./types";

export async function fetchTrends(): Promise<TrendsPayload> {
  return asJson<TrendsPayload>(await fetch("/api/intel/trends"));
}

/** Run one live sweep now (B6.5) — driver refusals surface verbatim as the thrown message. */
export async function sweepNow(): Promise<{ polled: number; cards: number }> {
  return asJson<{ polled: number; cards: number }>(await fetch("/api/intel/sweep", { method: "POST" }));
}

export async function createArea(input: {
  name: string;
  description: string;
  config?: MonitoredAreaConfig;
}): Promise<AreaRow> {
  const res = await fetch("/api/intel/areas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await asJson<{ area: AreaRow }>(res)).area;
}

export async function updateArea(
  areaId: string,
  patch: { name?: string; description?: string; config?: MonitoredAreaConfig; status?: MonitoredAreaStatus },
): Promise<AreaRow> {
  const res = await fetch(`/api/intel/areas/${areaId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  return (await asJson<{ area: AreaRow }>(res)).area;
}

export async function dismissTrend(cardId: string): Promise<IntelCapture> {
  const res = await fetch(`/api/intel/trends/${cardId}/dismiss`, { method: "POST" });
  return (await asJson<{ capture: IntelCapture }>(res)).capture;
}

export async function promoteTrend(
  cardId: string,
  pick: { family: CreateFamily; titleIndex?: number; angleIndex?: number },
): Promise<{ capture: IntelCapture; createHref: string }> {
  const res = await fetch(`/api/intel/trends/${cardId}/promote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(pick),
  });
  return asJson<{ capture: IntelCapture; createHref: string }>(res);
}

/** Resolve the structured intel→create handoff behind a capture id (wave-3 §3.3). */
export async function fetchCreateContext(captureId: string): Promise<CreateContext> {
  const res = await fetch(`/api/intel/context/${encodeURIComponent(captureId)}`);
  return (await asJson<{ context: CreateContext }>(res)).context;
}

export async function fetchTargets(): Promise<TargetRow[]> {
  return (await asJson<{ targets: TargetRow[] }>(await fetch("/api/intel/search/targets"))).targets;
}

export async function addTarget(keyword: string): Promise<{ target: TargetRow; created: boolean }> {
  const res = await fetch("/api/intel/search/targets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ keyword }),
  });
  return asJson<{ target: TargetRow; created: boolean }>(res);
}

export async function setTargetStatus(targetId: string, status: SearchTargetStatus): Promise<TargetRow> {
  const res = await fetch(`/api/intel/search/targets/${targetId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return (await asJson<{ target: TargetRow }>(res)).target;
}

export async function fetchHorizon(): Promise<HorizonPayload> {
  return asJson<HorizonPayload>(await fetch("/api/intel/search/horizon"));
}

export async function targetThis(query: string): Promise<{ capture: IntelCapture; createHref: string }> {
  const res = await fetch("/api/intel/search/target-this", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return asJson<{ capture: IntelCapture; createHref: string }>(res);
}
