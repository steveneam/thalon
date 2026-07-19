import { z } from "zod";

/**
 * B-int.0 (ADR 0011): the integrations contract — publish DESTINATIONS as
 * the product's unit (founder call 5: destinations, not social platforms).
 * One vocabulary shared by the vault (tenant_credentials), the Settings →
 * Integrations cards (B-int.2), and the driver rewire (B-int.3): a
 * destination key names WHAT a tenant connects; its class names what the
 * card powers; its driver names the code seat that consumes the credential.
 *
 * Everything here is config-shape and vocabulary — no crypto (B-int.1 owns
 * the envelope's wrap/unwrap behind the vault doors) and nothing that runs
 * against a live service. Registry entries are additive-only once frozen;
 * removing or renaming a key is a window-level change.
 */

/** What a destination card powers — the B-int.2 surface's grouping. */
export const DESTINATION_CLASSES = ["social", "website", "newsletter", "intel"] as const;
export type DestinationClass = (typeof DESTINATION_CLASSES)[number];

/**
 * Card states the surface may render (B-int.2's honest-states list).
 * Split deliberately:
 *  - STORED states live on the tenant_credentials row (`status` check
 *    constraint): "connected" | "needs_reauth".
 *  - DERIVED states never store: "not_connected" = no row exists;
 *    "expiring" = a stored row whose expiresAt is inside the re-auth
 *    horizon; "plan_gated" = the entitlements seam says no;
 *    "review_pending" = the destination's OAuth-Connect partner app
 *    (B-int.4) is still in platform review.
 */
export const CREDENTIAL_STORED_STATES = ["connected", "needs_reauth"] as const;
export type CredentialStoredState = (typeof CREDENTIAL_STORED_STATES)[number];

export const CREDENTIAL_CARD_STATES = [
  "not_connected",
  "connected",
  "needs_reauth",
  "expiring",
  "plan_gated",
  "review_pending",
] as const;
export type CredentialCardState = (typeof CREDENTIAL_CARD_STATES)[number];

/**
 * The sealed envelope the vault stores — opaque base64 fields plus the key
 * version that wrapped it. Produced and opened ONLY by the B-int.1 vault
 * doors (AES-256-GCM data key per row, wrapped by the box master key; KMS
 * is the recorded swap path behind the same shape). Contains no plaintext;
 * repos validate the SHAPE and never see inside.
 */
export const credentialEnvelopeSchema = z.object({
  ciphertext: z.string().min(1),
  dataKeyWrapped: z.string().min(1),
  iv: z.string().min(1),
  authTag: z.string().min(1),
  keyVersion: z.number().int().min(1),
});
export type CredentialEnvelope = z.infer<typeof credentialEnvelopeSchema>;

/**
 * One destination the product can connect. `credentials` is the mode-2
 * guided-paste payload the connect flow collects — validated at the vault
 * write door BEFORE encryption (B-int.1), so a malformed paste fails loud
 * and nothing stores. Labels are generic product copy, never platform
 * marketing names beyond the platform's own noun.
 */
export interface DestinationDef<Shape extends z.ZodTypeAny = z.ZodTypeAny> {
  class: DestinationClass;
  /** The driver seat that consumes this credential (B-pub.2 driver names, website driver class, intel source names). */
  driver: string;
  label: string;
  credentials: Shape;
}

const accessToken = z.object({ accessToken: z.string().min(1) });

/**
 * The registry. Keys are the vault's `destination` column vocabulary (check
 * constraint) and the cards' identity. TikTok ships NO entry on purpose
 * (review-gated, no driver — B-pub.2 kickoff scope); adding it later is
 * additive. `website_hosted` collects no secret — connecting it is the
 * tenant's explicit opt-in to the Thalon-hosted blog (an offering, never an
 * assumption), stored as an empty sealed payload so card states stay
 * uniform.
 */
export const DESTINATIONS = {
  linkedin: {
    class: "social",
    driver: "linkedin-rest-posts",
    label: "LinkedIn",
    credentials: accessToken,
  },
  x: {
    class: "social",
    driver: "x-v2-create-post",
    label: "X",
    credentials: accessToken,
  },
  facebook: {
    class: "social",
    driver: "facebook-page-feed",
    label: "Facebook Page",
    credentials: z.object({ accessToken: z.string().min(1), pageId: z.string().min(1) }),
  },
  instagram: {
    class: "social",
    driver: "instagram-text-refusal",
    label: "Instagram",
    credentials: z.object({ accessToken: z.string().min(1), igUserId: z.string().min(1) }),
  },
  website_hosted: {
    class: "website",
    driver: "own-site-blog",
    label: "Hosted blog",
    credentials: z.object({}),
  },
  website_wordpress: {
    class: "website",
    driver: "wordpress-rest",
    label: "WordPress site",
    credentials: z.object({
      baseUrl: z.string().min(1),
      username: z.string().min(1),
      applicationPassword: z.string().min(1),
    }),
  },
  website_ghost: {
    class: "website",
    driver: "ghost-admin",
    label: "Ghost site",
    credentials: z.object({ adminApiUrl: z.string().min(1), adminApiKey: z.string().min(1) }),
  },
  website_webhook: {
    class: "website",
    driver: "generic-webhook",
    label: "Webhook",
    credentials: z.object({ url: z.string().min(1), secret: z.string().min(1).optional() }),
  },
  newsletter_resend: {
    class: "newsletter",
    driver: "resend-broadcast",
    label: "Newsletter",
    credentials: z.object({ apiKey: z.string().min(1) }),
  },
  intel_youtube: {
    class: "intel",
    driver: "youtube",
    label: "YouTube intel",
    credentials: z.object({ apiKey: z.string().min(1) }),
  },
  intel_bluesky: {
    class: "intel",
    driver: "bluesky",
    label: "Bluesky intel",
    credentials: z.object({ identifier: z.string().min(1), appPassword: z.string().min(1) }),
  },
} as const satisfies Record<string, DestinationDef>;

export type DestinationKey = keyof typeof DESTINATIONS;
export const DESTINATION_KEYS = Object.keys(DESTINATIONS) as DestinationKey[];

export const destinationKeySchema = z.enum(
  DESTINATION_KEYS as [DestinationKey, ...DestinationKey[]],
);

export function resolveDestination(key: string): DestinationDef {
  const def = (DESTINATIONS as Record<string, DestinationDef>)[key];
  if (!def) {
    throw new Error(
      `unknown destination "${key}" — the registry knows: ${DESTINATION_KEYS.join(", ")}`,
    );
  }
  return def;
}
