import { asJson } from "@/lib/approve-queue/client";

/**
 * B-int.2 client seam: the Integrations surface's wire types + fetchers.
 * Shapes mirror the engine read models (cards.ts · published.ts) with Date
 * fields as ISO strings — the routes serialize, this file names.
 */

export type WireCardState =
  | "not_connected"
  | "connected"
  | "needs_reauth"
  | "expiring"
  | "plan_gated"
  | "review_pending";

export type WireDestinationClass = "social" | "website" | "newsletter" | "intel";

export interface WireIntegrationCard {
  destination: string;
  class: WireDestinationClass;
  label: string;
  driver: string;
  state: WireCardState;
  connectedAs: string | null;
  validatedAt: string | null;
  expiresAt: string | null;
  /** The box env fills this seat and takes precedence over the vault row. */
  envOverride: boolean;
  /** Whether this seat is ARMED — the fact that decides if anything posts. `null` where the class never posts. */
  armed: boolean | null;
  /** Why armed reads as it does, in the operator's words. */
  armedReason: string | null;
  fields: Array<{ key: string; optional: boolean }>;
}

export interface WireProbeOutcome {
  outcome: "validated" | "auth_failed" | "unreachable" | "unsupported";
  detail?: string;
  connectedAs?: string;
}

export interface WirePublishedItem {
  kind: "social" | "web";
  publishedAtMs: number;
  draftId: string;
  // social
  platform?: string;
  externalPostId?: string;
  permalink?: string | null;
  excerpt?: string;
  // web
  slug?: string;
  title?: string;
  path?: string;
}

export interface WirePublishedView {
  items: WirePublishedItem[];
  socialTotal: number;
  webTotal: number;
}

export interface ConnectResult {
  card: WireIntegrationCard;
  probe: WireProbeOutcome;
}

export async function fetchIntegrationCards(): Promise<WireIntegrationCard[]> {
  const { cards } = await asJson<{ cards: WireIntegrationCard[] }>(await fetch("/api/integrations"));
  return cards;
}

export async function fetchPublishedView(): Promise<WirePublishedView> {
  return asJson<WirePublishedView>(await fetch("/api/integrations/published"));
}

export async function connectIntegration(
  destination: string,
  credentials: Record<string, string>,
): Promise<ConnectResult> {
  return asJson<ConnectResult>(
    await fetch(`/api/integrations/${destination}/connect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credentials }),
    }),
  );
}

export async function validateIntegration(destination: string): Promise<ConnectResult> {
  return asJson<ConnectResult>(
    await fetch(`/api/integrations/${destination}/validate`, { method: "POST" }),
  );
}

export async function disconnectIntegration(destination: string): Promise<void> {
  await asJson<{ ok: boolean }>(
    await fetch(`/api/integrations/${destination}`, { method: "DELETE" }),
  );
}
