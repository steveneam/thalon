/**
 * C2/C4 (s82): the publish queue's browser clients and its wire types.
 *
 * The MEASUREMENT is never repeated here. `validateForPlatform` lives once,
 * in the engine, because the same function decides whether the queue
 * producer refuses a schedule — a second copy in the browser would
 * eventually disagree with the first, and the operator would be shown a
 * post that fits and then told it does not. So the fit crosses the wire
 * (`/api/social/fit`) and this file only describes its SHAPE.
 *
 * Lives under components/approve rather than lib/approve-queue (where the
 * surface's other clients sit) because lib/ is outside this lane's file
 * set; moving it there is a pure relocation whenever that file set opens.
 */

export interface QueueRowWire {
  id: string;
  draftId: string;
  platform: string;
  scheduledAt: string | null;
  status: "pending" | "processing" | "published" | "failed" | "cancelled" | string;
  /** Why a failed row failed, verbatim. */
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One piece of the body as the platform reads it — the preview's atom. */
export interface FitSegmentWire {
  kind: "text" | "link" | "hashtag";
  text: string;
  billed: number;
}

export interface PlatformFitWire {
  platform: string;
  fits: boolean;
  problems: Array<{ code: string; message: string }>;
  text: {
    rawChars: number;
    billedChars: number;
    maxChars: number;
    overBy: number;
    cutIndex: number;
    urlWeight: number | null;
    links: string[];
    hashtags: string[];
    maxHashtags: number | null;
    segments: FitSegmentWire[];
  };
  media: {
    count: number;
    required: boolean;
    maxImages: number;
    imageContentTypes: string[];
  };
  capability: { verifiedOn: string };
}

export type FitResponse =
  | {
      supported: true;
      /** The body the measurement describes — stale the moment the draft is edited. */
      bodyHash: string;
      fit: PlatformFitWire;
      /** A future instant derived from the operator's own planned-slot rhythm. */
      suggestedAt: string;
    }
  | { supported: false; platform: string; reason: string };

async function readError(res: Response, fallback: string): Promise<never> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? fallback);
}

/** The draft's fit against a platform's ceiling, measured server-side on its CURRENT body. */
export async function fetchDraftFit(draftId: string, platform?: string): Promise<FitResponse> {
  const params = new URLSearchParams({ draftId });
  if (platform) params.set("platform", platform);
  const res = await fetch(`/api/social/fit?${params.toString()}`);
  if (!res.ok) await readError(res, "Couldn’t measure this draft against the platform.");
  return (await res.json()) as FitResponse;
}

/** This draft's queue rows (every status) — what the card shows as its scheduled state. */
export async function fetchQueueRows(params: { draftId?: string; status?: string } = {}): Promise<
  QueueRowWire[]
> {
  const query = new URLSearchParams();
  if (params.draftId) query.set("draftId", params.draftId);
  if (params.status) query.set("status", params.status);
  const suffix = query.toString();
  const res = await fetch(`/api/social/queue${suffix ? `?${suffix}` : ""}`);
  if (!res.ok) await readError(res, "Couldn’t read the publish queue.");
  return ((await res.json()) as { rows: QueueRowWire[] }).rows;
}

/** Commit an approved draft to a platform at an instant. Every refusal arrives verbatim. */
export async function scheduleDraft(input: {
  draftId: string;
  platform: string;
  scheduledAt: string;
}): Promise<QueueRowWire> {
  const res = await fetch("/api/social/queue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await readError(res, "Couldn’t schedule this draft.");
  return ((await res.json()) as { row: QueueRowWire }).row;
}

/** Withdraw a commitment. Only an unclaimed row can be withdrawn — the repo's rulebook decides. */
export async function cancelQueueRow(id: string): Promise<QueueRowWire> {
  const res = await fetch(`/api/social/queue?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) await readError(res, "Couldn’t cancel this scheduled row.");
  return ((await res.json()) as { row: QueueRowWire }).row;
}

/** A row that still intends to publish — what makes a draft "scheduled" on any surface. */
export function isLiveQueueRow(row: QueueRowWire): boolean {
  return row.status === "pending" || row.status === "processing";
}
