import { createHmac } from "node:crypto";
import type { DestinationKey } from "@thalon/contracts";
import { FACEBOOK_GRAPH_VERSION } from "../social/drivers/facebook";
import { LINKEDIN_VERSION } from "../social/drivers/linkedin";
import { VaultNotConnectedError } from "./errors";
import { openCredentialRow, type DestinationCredentials, type VaultDeps } from "./vault";

/**
 * B-int.1 (ADR 0011): the read-only VALIDATE-PING seam — one probe per
 * destination, each the cheapest official read the platform offers, so a
 * card can flip honestly between `connected` (stamps validatedAt) and
 * `needs_reauth`. Probes never mutate remote state (the webhook destination
 * is therefore `unsupported`: firing a tenant's automation is not a probe;
 * Bluesky's createSession POST is the platform's own auth check and writes
 * nothing user-visible; LinkedIn's second call is a malformed-body POST that
 * can never initialize an upload — it exists to prove the version pin the
 * unversioned userinfo ping cannot see). Only an auth-shaped refusal flips a card to
 * needs_reauth — an unreachable network is not a credential problem and
 * leaves the card alone.
 *
 * Redaction: credentials travel in headers (never query strings), probe
 * outcomes carry status phrasing only, and this module never logs — pinned
 * by the redaction boundary test.
 */

export type ProbeOutcome =
  | { outcome: "validated"; connectedAs?: string }
  | { outcome: "auth_failed"; detail: string }
  | { outcome: "unreachable"; detail: string }
  | { outcome: "unsupported"; detail: string };

export interface ProbeContext {
  fetchImpl: typeof fetch;
  now: () => Date;
}

type Probe<K extends DestinationKey> = (
  credentials: DestinationCredentials<K>,
  probeCtx: ProbeContext,
) => Promise<ProbeOutcome>;

const PROBE_TIMEOUT_MS = 10_000;

function init(headers: Record<string, string>, extra: RequestInit = {}): RequestInit {
  return { headers, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS), ...extra };
}

/** Status → outcome for a non-ok response; auth-shaped statuses flip, the rest do not. */
function refusal(status: number, authStatuses: readonly number[]): ProbeOutcome {
  const detail = `the platform answered HTTP ${status}`;
  return authStatuses.includes(status)
    ? { outcome: "auth_failed", detail }
    : { outcome: "unreachable", detail };
}

async function bodyOf(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await res.json();
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Ghost Admin API auth: a short-lived HS256 JWT derived from the pasted
 * `id:secret` admin key (the official scheme — no library needed).
 */
function ghostToken(adminApiKey: string, now: Date): string {
  const [id, secret] = adminApiKey.split(":");
  const b64url = (data: Buffer | string): string =>
    (typeof data === "string" ? Buffer.from(data, "utf8") : data)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const iat = Math.floor(now.getTime() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT", kid: id }));
  const payload = b64url(JSON.stringify({ iat, exp: iat + 300, aud: "/admin/" }));
  const signature = b64url(
    createHmac("sha256", Buffer.from(secret ?? "", "hex"))
      .update(`${header}.${payload}`)
      .digest(),
  );
  return `${header}.${payload}.${signature}`;
}

/**
 * The registry — COMPLETE over DestinationKey by type and by test, so a new
 * destination cannot ship probe-less: it either gets a real read or an
 * explicit `unsupported` with its reason.
 */
export const VALIDATE_PROBES: { [K in DestinationKey]: Probe<K> } = {
  linkedin: async (creds, { fetchImpl }) => {
    const res = await fetchImpl(
      "https://api.linkedin.com/v2/userinfo",
      init({ Authorization: `Bearer ${creds.accessToken}` }),
    );
    if (!res.ok) return refusal(res.status, [401, 403]);
    const body = await bodyOf(res);
    const connectedAs = str(body?.name) ?? str(body?.sub);
    // s69 blind spot: userinfo is UNVERSIONED — it stayed green while the
    // pinned LinkedIn-Version was dead, and the first real post found out
    // live. Prove the pin with a malformed-body POST against a versioned
    // endpoint: an ACTIVE version answers 400 (bad body — nothing is ever
    // initialized), a dead pin answers 426. Only 426 degrades the outcome;
    // the token itself was just proven, so platform flakiness here never
    // blocks validation.
    const versioned = await fetchImpl(
      "https://api.linkedin.com/rest/images?action=initializeUpload",
      init(
        {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
          "LinkedIn-Version": LINKEDIN_VERSION,
          "X-Restli-Protocol-Version": "2.0.0",
        },
        { method: "POST", body: JSON.stringify({}) },
      ),
    );
    if (versioned.status === 426) {
      return {
        outcome: "unreachable",
        detail: `the token is valid but the pinned LinkedIn-Version ${LINKEDIN_VERSION} is no longer active (HTTP 426) — the engine's pin needs a bump, not the credential`,
      };
    }
    return { outcome: "validated", connectedAs };
  },

  x: async (creds, { fetchImpl }) => {
    const res = await fetchImpl(
      "https://api.x.com/2/users/me",
      init({ Authorization: `Bearer ${creds.accessToken}` }),
    );
    if (!res.ok) return refusal(res.status, [401, 403]);
    const body = await bodyOf(res);
    const username = str((body?.data as Record<string, unknown> | undefined)?.username);
    return { outcome: "validated", connectedAs: username ? `@${username}` : undefined };
  },

  facebook: async (creds, { fetchImpl }) => {
    const res = await fetchImpl(
      `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/${creds.pageId}?fields=name`,
      init({ Authorization: `Bearer ${creds.accessToken}` }),
    );
    // Graph reports auth failures as 400 (code 190) as well as 401/403.
    if (!res.ok) return refusal(res.status, [400, 401, 403]);
    const body = await bodyOf(res);
    return { outcome: "validated", connectedAs: str(body?.name) };
  },

  instagram: async (creds, { fetchImpl }) => {
    const res = await fetchImpl(
      `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/${creds.igUserId}?fields=username`,
      init({ Authorization: `Bearer ${creds.accessToken}` }),
    );
    if (!res.ok) return refusal(res.status, [400, 401, 403]);
    const body = await bodyOf(res);
    const username = str(body?.username);
    return { outcome: "validated", connectedAs: username ? `@${username}` : undefined };
  },

  website_hosted: async () => ({
    // Our own property, no secret collected — connecting IS the opt-in.
    outcome: "validated",
  }),

  website_wordpress: async (creds, { fetchImpl }) => {
    const basic = Buffer.from(`${creds.username}:${creds.applicationPassword}`, "utf8").toString(
      "base64",
    );
    const res = await fetchImpl(
      `${creds.baseUrl.replace(/\/$/, "")}/wp-json/wp/v2/users/me`,
      init({ Authorization: `Basic ${basic}` }),
    );
    if (!res.ok) return refusal(res.status, [401, 403]);
    const body = await bodyOf(res);
    return { outcome: "validated", connectedAs: str(body?.name) ?? creds.username };
  },

  website_ghost: async (creds, { fetchImpl, now }) => {
    const base = creds.adminApiUrl.replace(/\/$/, "");
    const root = base.endsWith("/ghost/api/admin") ? base : `${base}/ghost/api/admin`;
    const res = await fetchImpl(
      `${root}/site/`,
      init({ Authorization: `Ghost ${ghostToken(creds.adminApiKey, now())}` }),
    );
    if (!res.ok) return refusal(res.status, [401, 403]);
    const body = await bodyOf(res);
    const site = body?.site as Record<string, unknown> | undefined;
    return { outcome: "validated", connectedAs: str(site?.title) };
  },

  website_webhook: async () => ({
    outcome: "unsupported",
    detail:
      "a webhook has no read-only probe — firing the URL could trigger the site's automation; it validates on first publish",
  }),

  newsletter_resend: async (creds, { fetchImpl }) => {
    const res = await fetchImpl(
      "https://api.resend.com/domains",
      init({ Authorization: `Bearer ${creds.apiKey}` }),
    );
    if (!res.ok) return refusal(res.status, [401, 403]);
    return { outcome: "validated" };
  },

  intel_youtube: async (creds, { fetchImpl }) => {
    // The cheapest keyed read (1 quota unit); the key rides a header, not the URL.
    const res = await fetchImpl(
      "https://www.googleapis.com/youtube/v3/i18nLanguages?part=snippet",
      init({ "X-Goog-Api-Key": creds.apiKey }),
    );
    if (!res.ok) return refusal(res.status, [400, 401, 403]);
    return { outcome: "validated" };
  },

  intel_bluesky: async (creds, { fetchImpl }) => {
    // The platform's own auth check — a POST, but it mutates nothing user-visible.
    const res = await fetchImpl(
      "https://bsky.social/xrpc/com.atproto.server.createSession",
      init(
        { "Content-Type": "application/json" },
        {
          method: "POST",
          body: JSON.stringify({ identifier: creds.identifier, password: creds.appPassword }),
        },
      ),
    );
    if (!res.ok) return refusal(res.status, [400, 401, 403]);
    const body = await bodyOf(res);
    const handle = str(body?.handle);
    return { outcome: "validated", connectedAs: handle ? `@${handle}` : undefined };
  },
};

export interface ValidateResult {
  destination: DestinationKey;
  probe: ProbeOutcome;
  /** The stored-state flip this validation caused, if any. */
  flipped: "connected" | "needs_reauth" | null;
}

/**
 * Validate one connected destination: open its credential, run its probe,
 * and flip the stored card state honestly — `validated` stamps
 * connected+validatedAt, `auth_failed` marks needs_reauth, anything else
 * leaves the row untouched.
 */
export async function validateDestination(
  deps: VaultDeps,
  destination: DestinationKey,
  probeCtx: Partial<ProbeContext> = {},
): Promise<ValidateResult> {
  const row = await deps.repos.tenantCredentials.get(deps.ctx, destination);
  if (!row) {
    throw new VaultNotConnectedError(destination);
  }
  const credentials = openCredentialRow(deps, row);
  const resolved: ProbeContext = {
    fetchImpl: probeCtx.fetchImpl ?? fetch,
    now: probeCtx.now ?? (() => new Date()),
  };
  const probe = VALIDATE_PROBES[destination] as Probe<DestinationKey>;
  let outcome: ProbeOutcome;
  try {
    outcome = await probe(credentials as never, resolved);
  } catch (err) {
    outcome = {
      outcome: "unreachable",
      detail: `the probe could not reach the platform: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
  let flipped: ValidateResult["flipped"] = null;
  if (outcome.outcome === "validated") {
    await deps.repos.tenantCredentials.markStatus(deps.ctx, destination, "connected", {
      validatedAt: resolved.now(),
      // The probe's discovered identity (name / @handle / page title) becomes
      // the card's connected-as; a probe with none leaves the stored one be.
      ...(outcome.connectedAs !== undefined ? { connectedAs: outcome.connectedAs } : {}),
    });
    flipped = "connected";
  } else if (outcome.outcome === "auth_failed") {
    await deps.repos.tenantCredentials.markStatus(deps.ctx, destination, "needs_reauth");
    flipped = "needs_reauth";
  }
  return { destination, probe: outcome, flipped };
}
