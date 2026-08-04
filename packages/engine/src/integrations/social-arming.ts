import {
  socialPublishConfigSchema,
  type ArmState,
  type SocialPlatform,
  type SocialPublishConfig,
  type TenantCtx,
} from "@thalon/contracts";
import type { ThalonEnv } from "@thalon/platform";
import {
  productionSocialMetricsResolver,
  productionSocialPublisherResolver,
} from "../social/drivers";
import type { SocialMetricsReader } from "../social/metrics/registry";
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
const SOCIAL_VAULT_DESTINATIONS = ["linkedin", "x", "facebook", "instagram", "reddit", "bluesky"] as const;
export type SocialVaultDestination = (typeof SOCIAL_VAULT_DESTINATIONS)[number];

/** Whether a destination key is a social publish seat at all — website/intel/newsletter never post. */
export function isSocialVaultDestination(destination: string): destination is SocialVaultDestination {
  return (SOCIAL_VAULT_DESTINATIONS as readonly string[]).includes(destination);
}

/** platform → its env-override ARMED seat (the credential seats live in env-view's VAULT_ENV_SEATS). */
const SOCIAL_ARMED_SEATS = {
  linkedin: "SOCIAL_LINKEDIN_ARMED",
  x: "SOCIAL_X_ARMED",
  facebook: "SOCIAL_FACEBOOK_ARMED",
  instagram: "SOCIAL_INSTAGRAM_ARMED",
  reddit: "SOCIAL_REDDIT_ARMED",
  bluesky: "SOCIAL_BLUESKY_ARMED",
} as const satisfies Record<SocialVaultDestination, keyof ThalonEnv>;

export interface SocialArmingVerdict {
  armed: boolean;
  /** Why, in the operator's words — the Integrations card renders this verbatim. */
  reason: string;
}

/**
 * THE arming answer for one destination, from the two tenant-data facts that
 * decide it plus the emergency env override. Exported and shared so the
 * publish ratchet and the Integrations card cannot drift into two spellings
 * of "armed" — s78 added the card, and a second derivation would have been a
 * second truth.
 *
 * Env, when set, wins in BOTH directions: "true" force-arms a platform the
 * tenant never configured, anything else force-disarms one the tenant did.
 * That is what an emergency override means.
 */
export function socialArmed(
  env: ThalonEnv,
  destination: SocialVaultDestination,
  facts: { connected: boolean; configured: boolean },
): SocialArmingVerdict {
  const seat = SOCIAL_ARMED_SEATS[destination];
  const override = env[seat];
  if (override !== undefined && override !== "") {
    return override === "true"
      ? { armed: true, reason: `force-armed by ${seat} in the box environment` }
      : { armed: false, reason: `force-disarmed by ${seat} in the box environment` };
  }
  if (!facts.connected) return { armed: false, reason: "no stored credential to arm" };
  if (!facts.configured) {
    return {
      armed: false,
      reason: `not armed — the active profile's social block has no "${destination}" entry`,
    };
  }
  return { armed: true, reason: "armed by the active profile's social block" };
}

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
  for (const destination of SOCIAL_VAULT_DESTINATIONS) {
    // One spelling of "armed" — the same helper the Integrations card reads.
    const { armed } = socialArmed(view, destination, {
      connected: connected.has(destination),
      configured: Boolean(config?.[destination]),
    });
    if (armed) view[SOCIAL_ARMED_SEATS[destination]] ??= "true";
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
 * Control-arc part A (s102): the consumer's `resolveArmState` seam — the
 * QUEUE's per-destination arm state, read from the same tenant config block
 * as everything else here, and wired once per pass.
 *
 * ⛔ SCOPE, because the two arming facts in this file are easy to confuse:
 * `socialArmed` above answers *"may this platform be published to at all"* —
 * credential + configuredness, the publish door's rungs (b/c), and it governs
 * a MANUAL publish from Approve just as much as an automated one. This
 * answers a narrower question: *"may the unattended TICK send this
 * destination's due rows by itself"*. A destination at `off` therefore still
 * publishes when an operator does it deliberately through Approve — that path
 * has its own founder GO, and part A did not touch it.
 *
 * Fails closed at every step: no profile, no social block, no entry for the
 * platform, or an entry written before s102 (whose `armState` defaults to
 * `off`) all mean `off`.
 *
 * `runDuePublishes` walks due rows across EVERY tenant, and a tenant usually
 * owns several, so the profile read is memoized for the life of the pass.
 * Deliberately per-pass and no longer: an operator who flips a destination to
 * `off` must be obeyed by the next tick, not by whenever a process-wide cache
 * decided to expire.
 */
export function passArmStateResolver(deps: {
  repos: SocialArmingRepos;
  env: ThalonEnv;
  ctxFor: (tenantId: string) => TenantCtx;
}): (destination: { tenantId: string; platform: SocialPlatform }) => Promise<ArmState> {
  const perTenant = new Map<string, Promise<SocialPublishConfig | null>>();
  return async ({ tenantId, platform }) => {
    let config = perTenant.get(tenantId);
    if (!config) {
      config = readSocialConfig({ repos: deps.repos, env: deps.env, ctx: deps.ctxFor(tenantId) });
      perTenant.set(tenantId, config);
    }
    return (await config)?.[platform]?.armState ?? "off";
  };
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

/**
 * D2 (s87): the same vault-first assembly for the METRICS tick — and the one
 * deliberate difference in this whole file.
 *
 * It resolves over `vaultEnvView` DIRECTLY rather than `vaultSocialEnvView`,
 * so the credential seats are filled and the `SOCIAL_<P>_ARMED` seats are
 * NOT. That is not an oversight to tidy up later: measurement needs a
 * connected credential, not the founder's per-platform POSTING GO. Routing it
 * through the arming view would mean that disarming a platform — an ordinary,
 * correct operator move, and the emergency override's entire purpose —
 * silently stopped measuring every post that platform ever carried. The
 * metrics ratchet (`resolveSocialMetricsReader`) has one seat by design, and
 * this is the wiring that keeps it that way.
 *
 * Nothing here can post: a `SocialMetricsReader` has no publish verb.
 */
export async function vaultSocialMetricsResolver(
  deps: SocialArmingDeps,
): Promise<(platform: SocialPlatform) => SocialMetricsReader> {
  const { view } = await vaultEnvView(deps, SOCIAL_VAULT_DESTINATIONS);
  return productionSocialMetricsResolver(view);
}
