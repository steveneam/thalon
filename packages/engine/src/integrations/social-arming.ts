import type { SocialPlatform } from "@thalon/contracts";
import type { ThalonEnv } from "@thalon/platform";
import { productionSocialPublisherResolver } from "../social/drivers";
import type { SocialPublisher } from "../social/registry";
import { decodeVaultMasterKey } from "./crypto";
import { openCredentialRow, type VaultDeps } from "./vault";

/**
 * B-int.1 (ADR 0011 decision 3): the self/dogfood tenant moves ONTO the
 * vault — token material resolves vault-first, and the env pairs become the
 * emergency override only. Concretely: for each social destination the
 * tenant has CONNECTED (needs_reauth never arms), the vault's opened
 * credential fills the platform's token/extra seats WHERE ENV IS SILENT —
 * an env value, when set, still wins, because that is what an emergency
 * override means. Everything then walks the UNTOUCHED per-platform arming
 * ratchet: the `SOCIAL_<P>_ARMED="true"` founder GO stays env-side and
 * per-platform (a connected account is not an armed one — ADR 0011); B-int.3
 * moves arming itself onto tenant data.
 *
 * Failure posture: a vault row that exists but will not open is a box-level
 * misconfiguration (wrong/absent master key), not a per-platform condition —
 * it throws loud rather than silently degrading to disarmed.
 */

/** The social destinations ↔ platform seats (same strings by design; tiktok has no destination — review-gated, no driver). */
const SOCIAL_VAULT_DESTINATIONS = ["linkedin", "x", "facebook", "instagram"] as const;
type SocialVaultDestination = (typeof SOCIAL_VAULT_DESTINATIONS)[number];

function isSocialVaultDestination(value: string): value is SocialVaultDestination {
  return (SOCIAL_VAULT_DESTINATIONS as readonly string[]).includes(value);
}

/**
 * The merged env VIEW the resolver ratchet consumes: the validated env with
 * vault-opened token material filled into seats env left empty. Exported
 * separately from the resolver so tests can pin the precedence table
 * without reaching inside a driver.
 */
export async function vaultSocialEnvView(deps: VaultDeps): Promise<ThalonEnv> {
  const rows = (await deps.repos.tenantCredentials.list(deps.ctx)).filter(
    (row) => row.status === "connected" && isSocialVaultDestination(row.destination),
  );
  if (rows.length === 0) {
    return deps.env;
  }
  // Rows exist → the master key must be able to open them; refuse loud if not.
  decodeVaultMasterKey(deps.env.THALON_VAULT_MASTER_KEY);
  const view: ThalonEnv = { ...deps.env };
  for (const row of rows) {
    const creds = openCredentialRow(deps, row) as Record<string, string>;
    switch (row.destination as SocialVaultDestination) {
      case "linkedin":
        view.SOCIAL_LINKEDIN_ACCESS_TOKEN ??= creds.accessToken;
        break;
      case "x":
        view.SOCIAL_X_ACCESS_TOKEN ??= creds.accessToken;
        break;
      case "facebook":
        view.SOCIAL_FACEBOOK_ACCESS_TOKEN ??= creds.accessToken;
        view.SOCIAL_FACEBOOK_PAGE_ID ??= creds.pageId;
        break;
      case "instagram":
        view.SOCIAL_INSTAGRAM_ACCESS_TOKEN ??= creds.accessToken;
        view.SOCIAL_INSTAGRAM_USER_ID ??= creds.igUserId;
        break;
    }
  }
  return view;
}

/**
 * The production caller's vault-aware assembly: one list+open pass, then the
 * existing sync resolver over the merged view — one ratchet, one wiring.
 */
export async function vaultSocialPublisherResolver(
  deps: VaultDeps,
): Promise<(platform: SocialPlatform) => SocialPublisher> {
  return productionSocialPublisherResolver(await vaultSocialEnvView(deps));
}
