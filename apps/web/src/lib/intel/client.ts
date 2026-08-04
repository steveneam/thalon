import type { MonitoredAreaConfig, MonitoredAreaStatus, SearchTargetStatus } from "@thalon/contracts";
import { asJson } from "@/lib/approve-queue/client";
import type {
  AreaRow,
  CreateContext,
  CreateFamily,
  HorizonPayload,
  IntelCapture,
  IntelPickWire,
  TargetRow,
  TrendsPayload,
} from "./types";

export async function fetchTrends(): Promise<TrendsPayload> {
  return asJson<TrendsPayload>(await fetch("/api/intel/trends"));
}

/** The pipeline board's Intel-picks read — promoted trends only, newest last. */
export async function fetchIntelPicks(): Promise<IntelPickWire[]> {
  return (await asJson<{ picks: IntelPickWire[] }>(await fetch("/api/intel/picks"))).picks;
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

/**
 * A trend card's id is `<areaId>:<the platform's own item id>`, and on
 * Bluesky the platform's id is an AT-URI —
 * `at://did:plc:…/app.bsky.feed.post/3ms7…` — which contains SLASHES. Dropped
 * raw into a path template those slashes become path separators, so the
 * request lands on a route that does not exist: proven live, 404 raw vs 200
 * encoded, on 30 of the 58 cards on the dev shelf.
 *
 * That is why this exists as one function rather than two template literals:
 * `fetchCreateContext` below already encoded, these two did not, and nothing
 * made the difference visible until half the list stopped working. Encoding
 * the segment is not a style choice here — it is the only reason a Bluesky
 * card can be promoted or dismissed at all (s100 gate).
 */
const trendCardPath = (cardId: string, verb: "dismiss" | "promote") =>
  `/api/intel/trends/${encodeURIComponent(cardId)}/${verb}`;

export async function dismissTrend(cardId: string): Promise<IntelCapture> {
  const res = await fetch(trendCardPath(cardId, "dismiss"), { method: "POST" });
  return (await asJson<{ capture: IntelCapture }>(res)).capture;
}

export async function promoteTrend(
  cardId: string,
  pick: { family: CreateFamily; titleIndex?: number; angleIndex?: number },
): Promise<{ capture: IntelCapture; createHref: string }> {
  const res = await fetch(trendCardPath(cardId, "promote"), {
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
