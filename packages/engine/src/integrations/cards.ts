import {
  DESTINATION_KEYS,
  DESTINATIONS,
  type CredentialCardState,
  type DestinationClass,
  type DestinationKey,
  type EntitlementFeature,
} from "@thalon/contracts";
import { z } from "zod";
import { VAULT_ENV_SEATS } from "./env-view";
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
  opts: { features: Record<EntitlementFeature, boolean>; now?: Date },
): Promise<IntegrationCard[]> {
  const stored = await listCredentialCards(deps);
  const byDestination = new Map(stored.map((card) => [card.destination, card]));
  const now = opts.now ?? new Date();
  return DESTINATION_KEYS.map((destination) => {
    const def = DESTINATIONS[destination];
    const row = byDestination.get(destination) ?? null;
    const feature = CLASS_ENTITLEMENT[def.class];
    const entitled = feature === null ? true : opts.features[feature];
    return {
      destination,
      class: def.class,
      label: def.label,
      driver: def.driver,
      state: deriveCardState({ stored: row, entitled, now }),
      connectedAs: row?.connectedAs ?? null,
      validatedAt: row?.validatedAt ?? null,
      expiresAt: row?.expiresAt ?? null,
      envOverride: envOverridesDestination(deps.env, destination),
      fields: pasteFields(destination),
    };
  });
}
