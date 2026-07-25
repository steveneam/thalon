import type { DestinationKey } from "@thalon/contracts";
import type { ThalonEnv } from "@thalon/platform";
import {
  resolveSendTransport,
  type ResolveSendTransportOptions,
  type SendTransport,
} from "../outreach/transport";
import { decodeVaultMasterKey } from "./crypto";
import { openCredentialRow, type VaultDeps } from "./vault";

/**
 * B-int.3 (ADR 0011): THE precedence table — every credentialed seam
 * resolves vault-first by tenant through this one module. The pattern is
 * B-int.1's merged env VIEW, generalized: for each destination the tenant
 * has CONNECTED (needs_reauth never contributes), the vault's opened
 * credential fills the seam's env seats WHERE ENV IS SILENT — an env value,
 * when set, still wins, because that is what an emergency override means.
 * The social/intel/outreach views below are the same table filtered by
 * destination; there is deliberately no second precedence rule anywhere.
 *
 * Failure posture (unchanged from B-int.1): a vault row that exists but
 * will not open is a box-level misconfiguration (wrong/absent master key),
 * not a per-destination condition — it throws loud rather than silently
 * degrading to disarmed.
 */

/** The env seats a vault credential may fill — all optional strings in the platform schema. */
type VaultSeatEnvKey =
  | "SOCIAL_LINKEDIN_ACCESS_TOKEN"
  | "SOCIAL_X_ACCESS_TOKEN"
  | "SOCIAL_FACEBOOK_ACCESS_TOKEN"
  | "SOCIAL_FACEBOOK_PAGE_ID"
  | "SOCIAL_INSTAGRAM_ACCESS_TOKEN"
  | "SOCIAL_INSTAGRAM_USER_ID"
  | "RESEND_API_KEY"
  | "YOUTUBE_API_KEY"
  | "BLUESKY_IDENTIFIER"
  | "BLUESKY_APP_PASSWORD";

/**
 * destination → { credential field → env seat }. Everything that reads the
 * table reads THIS one: the merged views (fills) and the B-int.2 cards'
 * env-override badge (honesty) — never a hand-list per seam.
 */
export const VAULT_ENV_SEATS = {
  linkedin: { accessToken: "SOCIAL_LINKEDIN_ACCESS_TOKEN" },
  x: { accessToken: "SOCIAL_X_ACCESS_TOKEN" },
  facebook: { accessToken: "SOCIAL_FACEBOOK_ACCESS_TOKEN", pageId: "SOCIAL_FACEBOOK_PAGE_ID" },
  instagram: {
    accessToken: "SOCIAL_INSTAGRAM_ACCESS_TOKEN",
    igUserId: "SOCIAL_INSTAGRAM_USER_ID",
  },
  newsletter_resend: { apiKey: "RESEND_API_KEY" },
  intel_youtube: { apiKey: "YOUTUBE_API_KEY" },
  intel_bluesky: { identifier: "BLUESKY_IDENTIFIER", appPassword: "BLUESKY_APP_PASSWORD" },
} as const satisfies Partial<Record<DestinationKey, Record<string, VaultSeatEnvKey>>>;

export type VaultSeatDestination = keyof typeof VAULT_ENV_SEATS;

export interface VaultEnvViewResult {
  /** The validated env with vault-opened credentials filled into seats env left empty. */
  view: ThalonEnv;
  /** Which of the requested destinations had a CONNECTED row — the tenant-data arming input (B-int.3). */
  connected: ReadonlySet<VaultSeatDestination>;
}

/**
 * The one merged-view builder: list the tenant's rows once, open only the
 * requested + connected ones, fill their seats where env is silent. No rows
 * → the view IS the env, untouched (and the master key is never demanded).
 */
export async function vaultEnvView(
  deps: VaultDeps,
  destinations: readonly VaultSeatDestination[],
): Promise<VaultEnvViewResult> {
  const wanted = new Set<string>(destinations);
  const rows = (await deps.repos.tenantCredentials.list(deps.ctx)).filter(
    (row) => row.status === "connected" && wanted.has(row.destination),
  );
  if (rows.length === 0) {
    return { view: deps.env, connected: new Set() };
  }
  // Rows exist → the master key must be able to open them; refuse loud if not.
  decodeVaultMasterKey(deps.env.THALON_VAULT_MASTER_KEY);
  const view: ThalonEnv = { ...deps.env };
  const connected = new Set<VaultSeatDestination>();
  for (const row of rows) {
    const destination = row.destination as VaultSeatDestination;
    const creds = openCredentialRow(deps, row) as Record<string, string | undefined>;
    for (const [credKey, envKey] of Object.entries(VAULT_ENV_SEATS[destination]) as Array<
      [string, VaultSeatEnvKey]
    >) {
      view[envKey] ??= creds[credKey];
    }
    connected.add(destination);
  }
  return { view, connected };
}

const INTEL_DESTINATIONS = ["intel_youtube", "intel_bluesky"] as const;

/**
 * B-int.3 mission 2: the intel sweep drivers' merged view — `intel_youtube`
 * fills YOUTUBE_API_KEY, `intel_bluesky` fills BLUESKY_IDENTIFIER +
 * BLUESKY_APP_PASSWORD, env seats stay the override. Source SELECTION
 * (TREND_SOURCE) stays box config — only credential material is tenant data.
 */
export async function vaultIntelEnvView(deps: VaultDeps): Promise<ThalonEnv> {
  return (await vaultEnvView(deps, INTEL_DESTINATIONS)).view;
}

/**
 * B-int.3 mission 3: the outreach transport's merged view — the tenant's
 * `newsletter_resend` credential fills RESEND_API_KEY where env is silent.
 * OUTREACH_SEND_ARMED is deliberately NOT a seat: arming ≠ credentials here
 * — the B-crm.4 founder GO stays env-side exactly as frozen.
 */
export async function vaultOutreachEnvView(deps: VaultDeps): Promise<ThalonEnv> {
  return (await vaultEnvView(deps, ["newsletter_resend"])).view;
}

/**
 * The future live-send caller's vault-aware assembly: one merged view, then
 * the UNTOUCHED two-key arming ratchet over it — one ratchet, one wiring
 * (the vaultSocialPublisherResolver shape applied to outreach).
 */
export async function vaultSendTransportResolver(
  deps: VaultDeps,
  opts: ResolveSendTransportOptions = {},
): Promise<SendTransport> {
  return resolveSendTransport(await vaultOutreachEnvView(deps), opts);
}
