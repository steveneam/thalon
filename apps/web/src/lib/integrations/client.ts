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
  /** D1: "oauth2" cards connect via consent redirect; "app_password"/"manual" keep the guided paste. */
  connectFlavor: "manual" | "oauth2" | "app_password";
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

/** D1: begin the OAuth dance — the server mints the single-use state and hands back the consent URL. */
export async function beginOauthIntegration(destination: string): Promise<{ authorizeUrl: string }> {
  return asJson<{ authorizeUrl: string }>(
    await fetch(`/api/integrations/${destination}/oauth`, { method: "POST" }),
  );
}

/** D1 (disconnect honesty): how many pending queue rows would fail closed if this platform disconnects. */
export async function fetchPendingQueueCount(platform: string): Promise<number | null> {
  try {
    const { rows } = await asJson<{ rows: unknown[] }>(
      await fetch(`/api/social/queue?status=pending&platform=${encodeURIComponent(platform)}`),
    );
    return rows.length;
  } catch {
    // The count is a courtesy fact — a read failure must not block disconnect.
    return null;
  }
}
