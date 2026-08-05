import {
  DESTINATION_KEYS,
  DESTINATIONS,
  type ConnectFlavor,
  type DestinationDef,
  type CredentialCardState,
  type DestinationClass,
  type DestinationKey,
  type ArmState,
  type EntitlementFeature,
  type SocialPublishConfig,
} from "@thalon/contracts";
import { z } from "zod";
import { VAULT_ENV_SEATS } from "./env-view";
import { isSocialVaultDestination, socialArmed } from "./social-arming";
import { listCredentialCards, type CredentialCard, type VaultDeps } from "./vault";

/**
 * B-int.2 (ADR 0011): the Integrations surface's card read model — the full
 * DESTINATIONS registry merged with the tenant's vault rows and the
 * entitlements answer, every card in one of the frozen honest states
 * (contracts CREDENTIAL_CARD_STATES). Derivation lives HERE, engine-side,
 * so the API route stays thin and no UI re-derives state. `review_pending`
 * is in the vocabulary but never produced yet: it describes a destination
 * whose ONLY connect path awaits a platform's partner-app review, and mode-2
 * guided connect exists for every registry entry today (B-int.4 introduces
 * the producer).
 */

/** Surface grouping: class → the order and the product copy the cards render under. */
export const DESTINATION_CLASS_ORDER: DestinationClass[] = [
  "social",
  "website",
  "newsletter",
  "intel",
];

export const DESTINATION_CLASS_LABELS: Record<DestinationClass, string> = {
  social: "Social publishing",
  website: "Your website",
  newsletter: "Outreach & newsletter",
  intel: "Intel sources",
};

/**
 * Which entitlement feature gates a class. Only social publishing rides the
 * ladder today (Sprint-8 window 2); the rest are ungated by design until a
 * pricing call adds their keys — additive, like the feature list itself.
 */
const CLASS_ENTITLEMENT: Record<DestinationClass, EntitlementFeature | null> = {
  social: "social_publishing",
  website: null,
  newsletter: null,
  intel: null,
};

/**
 * How close to `expiresAt` a connected card starts reading "expiring".
 * LinkedIn's ~60-day member tokens are the horizon's sizing case: two weeks
 * is enough to re-run a guided connect without a dead-token surprise.
 */
export const EXPIRING_HORIZON_DAYS = 14;

/** One mode-2 paste field, derived from the registry's connect schema — never hand-listed per platform. */
export interface IntegrationCardField {
  key: string;
  optional: boolean;
}

/**
 * A card for a destination whose credential seat is env-filled must say so,
 * or the surface lies about the arming story (the dogfood tenant's X rides
 * env 1.0a seats while its vault row may not even exist). Which seats exist
 * is read off the ONE precedence table (env-view VAULT_ENV_SEATS — B-int.3:
 * an env value, when set, wins over the vault), never hand-listed here —
 * so intel and newsletter destinations report their overrides too.
 */
function envOverridesDestination(env: VaultDeps["env"], destination: DestinationKey): boolean {
  const seats = (VAULT_ENV_SEATS as Partial<Record<DestinationKey, Record<string, string>>>)[
    destination
  ];
  if (!seats) return false;
  return Object.values(seats).some((envKey) => Boolean(env[envKey as keyof typeof env]));
}

/** The wire-ready card: everything the surface renders, nothing an envelope ever rode. */
export interface IntegrationCard {
  destination: DestinationKey;
  class: DestinationClass;
  label: string;
  driver: string;
  state: CredentialCardState;
  connectedAs: string | null;
  validatedAt: Date | null;
  expiresAt: Date | null;
  /** True when the box env fills any of this destination's credential seats — env takes precedence over the vault row (emergency-override honesty, read off the one precedence table). */
  envOverride: boolean;
  /**
   * s78: whether this seat is ARMED — the fact that decides whether anything
   * posts, and the top rung of the ladder the card already enumerates
   * (plan-gating, expiry, re-auth, env precedence). A credential can be
   * perfectly healthy and post nothing, so "Connected" alone was a status
   * ladder with its most consequential rung missing. `null` for destinations
   * that never post (website · newsletter · intel).
   */
  armed: boolean | null;
  /** Why armed reads as it does, in the operator's words. `null` alongside `armed: null`. */
  armedReason: string | null;
  /**
   * s103 (control-arc part A): the QUEUE's per-destination gate — whether the
   * unattended tick may send this destination's due rows by itself.
   *
   * ⛔ A DIFFERENT FACT from `armed` above, and the card renders both because
   * conflating them is how an operator ends up surprised. `armed` answers
   * "may this platform be published to at all" (credential + configuredness)
   * and governs a MANUAL publish from Approve too; this answers only what the
   * tick may do unattended. A destination can be `armed` with `armState:
   * "off"` — perfectly publishable by hand, and never by itself.
   *
   * This is the STORED value, never the posting scope's overlay of it: the
   * surface states the mode's effect beside the stored state rather than
   * rewriting it, which is what keeps `all` legible and the flip back
   * lossless. `null` for destinations that never post.
   */
  armState: ArmState | null;
  /**
   * s103: whether this destination has an ENTRY in the tenant's social block
   * at all — the fact `armState` alone cannot carry, because a destination
   * with no entry and one deliberately set to `off` both read `off`.
   *
   * The surface owes the difference in words: setting a state on a
   * destination with no entry CREATES one, and an entry is also what
   * authorizes a manual publish. Stating that at the control is the whole
   * reason this rides the wire. `null` for destinations that never post.
   */
  postingConfigured: boolean | null;
  /**
   * D1 (s83): how this destination CONNECTS — "oauth2" cards offer the
   * consent-redirect dance (one click, no paste), "app_password" and
   * "manual" keep the schema-derived guided paste. From the registry's
   * connect field; absent = manual, the pre-D1 behavior.
   */
  connectFlavor: ConnectFlavor;
  fields: IntegrationCardField[];
}

/**
 * The one state-derivation rule (contracts documents the split; this
 * implements it): plan-gating wins even over a stored row — an entitlement
 * revoked mid-connection reads plan_gated, honestly unusable; then absence,
 * the stored needs_reauth, the expiry horizon, and finally connected.
 */
export function deriveCardState(input: {
  stored: Pick<CredentialCard, "status" | "expiresAt"> | null;
  entitled: boolean;
  now: Date;
}): CredentialCardState {
  if (!input.entitled) return "plan_gated";
  if (!input.stored) return "not_connected";
  if (input.stored.status === "needs_reauth") return "needs_reauth";
  if (
    input.stored.expiresAt &&
    input.stored.expiresAt.getTime() - input.now.getTime() <
      EXPIRING_HORIZON_DAYS * 24 * 60 * 60 * 1000
  ) {
    return "expiring";
  }
  return "connected";
}

/** The guided flow's paste fields, read off the destination's zod connect shape. */
export function pasteFields(destination: DestinationKey): IntegrationCardField[] {
  const schema = DESTINATIONS[destination].credentials;
  if (!(schema instanceof z.ZodObject)) return [];
  return Object.entries(schema.shape as Record<string, z.ZodTypeAny>).map(([key, field]) => ({
    key,
    optional: field.safeParse(undefined).success,
  }));
}

/**
 * The cards read behind GET /api/integrations: every registry destination,
 * in registry order, with the tenant's stored rows and entitlement answers
 * folded in. `features` comes from the entitlements repo's getEffective —
 * resolution stays contracts `isEntitled`, never re-derived here.
 */
export async function listIntegrationCards(
  deps: VaultDeps,
  opts: {
    features: Record<EntitlementFeature, boolean>;
    now?: Date;
    /**
     * The active profile's social block — the tenant-data half of arming
     * (s78). Passed in rather than read here so this stays a pure merge of
     * vault + entitlements + env, and so a card read never opens an
     * envelope to answer "is it armed".
     */
    socialConfig?: SocialPublishConfig | null;
  },
): Promise<IntegrationCard[]> {
  const stored = await listCredentialCards(deps);
  const byDestination = new Map(stored.map((card) => [card.destination, card]));
  const now = opts.now ?? new Date();
  return DESTINATION_KEYS.map((destination) => {
    // Widened through the interface: `as const` entries without a `connect`
    // field have no such property in their literal type.
    const def: DestinationDef = DESTINATIONS[destination];
    const row = byDestination.get(destination) ?? null;
    const feature = CLASS_ENTITLEMENT[def.class];
    const entitled = feature === null ? true : opts.features[feature];
    const state = deriveCardState({ stored: row, entitled, now });
    // Arming is a SOCIAL fact — nothing else posts, so nothing else claims a
    // rung it does not have. The entry is read once here, narrowed, and both
    // arming facts below are derived from it rather than re-indexing.
    const entry = isSocialVaultDestination(destination)
      ? opts.socialConfig?.[destination]
      : undefined;
    const arming =
      isSocialVaultDestination(destination) && entitled
        ? socialArmed(deps.env, destination, {
            connected: state === "connected" || state === "expiring" || state === "needs_reauth",
            configured: Boolean(entry),
          })
        : null;
    return {
      destination,
      class: def.class,
      label: def.label,
      driver: def.driver,
      state,
      connectedAs: row?.connectedAs ?? null,
      validatedAt: row?.validatedAt ?? null,
      expiresAt: row?.expiresAt ?? null,
      envOverride: envOverridesDestination(deps.env, destination),
      armed: arming?.armed ?? null,
      armedReason: arming?.reason ?? null,
      // The STORED gate, defaulting to `off` for a social seat with no entry —
      // absence disarms here exactly as it does everywhere else in this block.
      armState: arming ? (entry?.armState ?? "off") : null,
      postingConfigured: arming ? Boolean(entry) : null,
      connectFlavor: def.connect?.flavor ?? "manual",
      fields: pasteFields(destination),
    };
  });
}
