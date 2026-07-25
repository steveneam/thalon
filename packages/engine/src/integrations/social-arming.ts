import {
  socialPublishConfigSchema,
  type SocialPlatform,
  type SocialPublishConfig,
  type TenantCtx,
} from "@thalon/contracts";
import type { ThalonEnv } from "@thalon/platform";
import { productionSocialPublisherResolver } from "../social/drivers";
import type { SocialPublisher } from "../social/registry";
import { vaultEnvView } from "./env-view";
import type { VaultDeps, VaultRepos } from "./vault";

/**
 * B-int.3 (ADR 0011): social ARMING IS TENANT DATA. The refusal ladder's
 * "unarmed platform" rung now reads: the platform PRESENT in the tenant's
 * social config block (`socialPublishConfigSchema` — an absent platform was
 * always defined as unarmed) AND the destination's vault credential
 * `connected`. Both facts fill the merged env VIEW the untouched
 * per-platform ratchet consumes: vault token material fills the credential
 * seats env left empty (B-int.1), and tenant-data arming fills the
 * `SOCIAL_<P>_ARMED` seat with "true" where env is silent. The env pair is
 * now the emergency OVERRIDE only — set, it wins in BOTH directions
 * ("true" force-arms a platform the tenant never configured; anything else
 * force-disarms one the tenant did), because that is what an emergency
 * override means. The ladder's SHAPE — typed refusals, per-platform caps,
 * duplicate guard — is untouched: this module only decides what the
 * ratchet's env view says.
 *
 * Failure posture: a vault row that exists but will not open is a box-level
 * misconfiguration (wrong/absent master key), not a per-platform condition —
 * it throws loud rather than silently degrading to disarmed.
 */

/** The social destinations ↔ platform seats (same strings by design; tiktok has no destination — review-gated, no driver). */
const SOCIAL_VAULT_DESTINATIONS = ["linkedin", "x", "facebook", "instagram"] as const;
type SocialVaultDestination = (typeof SOCIAL_VAULT_DESTINATIONS)[number];

/** platform → its env-override ARMED seat (the credential seats live in env-view's VAULT_ENV_SEATS). */
const SOCIAL_ARMED_SEATS = {
  linkedin: "SOCIAL_LINKEDIN_ARMED",
  x: "SOCIAL_X_ARMED",
  facebook: "SOCIAL_FACEBOOK_ARMED",
  instagram: "SOCIAL_INSTAGRAM_ARMED",
} as const satisfies Record<SocialVaultDestination, keyof ThalonEnv>;

/**
 * The arming rung reads two tenant-data facts, so the deps widen past the
 * vault: the active brand profile carries the social config block. The full
 * db Repos bundle satisfies this structurally — tests hand a stub.
 */
export interface SocialArmingRepos extends VaultRepos {
  brandProfiles: {
    getActive(ctx: TenantCtx): Promise<{ social: unknown } | null>;
  };
}

export interface SocialArmingDeps extends VaultDeps {
  repos: SocialArmingRepos;
}

/**
 * The merged env VIEW the resolver ratchet consumes: credential seats from
 * the one precedence table (env-view.ts), ARMED seats from tenant data —
 * env wins wherever it is set. Exported separately from the resolver so
 * tests can pin the precedence table without reaching inside a driver.
 */
export async function vaultSocialEnvView(deps: SocialArmingDeps): Promise<ThalonEnv> {
  const { view, connected } = await vaultEnvView(deps, SOCIAL_VAULT_DESTINATIONS);
  // Tenant-data arming needs a CONNECTED credential — nothing connected
  // means nothing to arm, and the profile read is skipped on purpose.
  if (connected.size === 0) return view;
  const config = await readSocialConfig(deps);
  if (config) {
    for (const destination of SOCIAL_VAULT_DESTINATIONS) {
      if (config[destination] && connected.has(destination)) {
        view[SOCIAL_ARMED_SEATS[destination]] ??= "true";
      }
    }
  }
  return view;
}

/** The publish door's rung-c read, applied here to the ARMING rung: a stored block is never trusted shapeless. */
async function readSocialConfig(deps: SocialArmingDeps): Promise<SocialPublishConfig | null> {
  const profile = await deps.repos.brandProfiles.getActive(deps.ctx);
  if (!profile || profile.social === undefined || profile.social === null) return null;
  return socialPublishConfigSchema.parse(profile.social);
}

/**
 * The production caller's vault-aware assembly: one list+open pass + one
 * profile read, then the existing sync resolver over the merged view — one
 * ratchet, one wiring.
 */
export async function vaultSocialPublisherResolver(
  deps: SocialArmingDeps,
): Promise<(platform: SocialPlatform) => SocialPublisher> {
  return productionSocialPublisherResolver(await vaultSocialEnvView(deps));
}
