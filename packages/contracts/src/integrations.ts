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
 * How a destination's credential ARRIVES (D1, s83) — the connect flow's
 * vocabulary. Every flavor lands in the same vault through the same write
 * door; the flavor only decides which door the card offers:
 *  - "manual": mode-2 guided paste of schema-derived fields (the B-int.2
 *    default — every pre-D1 destination).
 *  - "oauth2": the generic authorization-code dance — one connect door, one
 *    dynamic callback route, single-use state rows; the exchange writes the
 *    vault, never the operator.
 *  - "app_password": the platform's own designed paste (an app-scoped
 *    secret the user mints in the platform's settings) — a paste by DESIGN,
 *    not a workaround, so it stays a paste with validate-on-connect.
 */
export const CONNECT_FLAVORS = ["manual", "oauth2", "app_password"] as const;
export type ConnectFlavor = (typeof CONNECT_FLAVORS)[number];

/**
 * One destination the product can connect. `credentials` is the payload the
 * connect flow stores — for "manual"/"app_password" flavors the guided-paste
 * fields, for "oauth2" the token material the exchange yields — validated at
 * the vault write door BEFORE encryption (B-int.1), so a malformed payload
 * fails loud and nothing stores. Labels are generic product copy, never
 * platform marketing names beyond the platform's own noun.
 */
export interface DestinationDef<Shape extends z.ZodTypeAny = z.ZodTypeAny> {
  class: DestinationClass;
  /** The driver seat that consumes this credential (B-pub.2 driver names, website driver class, intel source names). */
  driver: string;
  label: string;
  credentials: Shape;
  /** Connect-flow flavor + platform scopes. Absent = "manual" (every pre-D1 entry, unchanged). */
  connect?: { flavor: ConnectFlavor; scopes?: readonly string[] };
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
    // s84: onto the dance. The yield is the member token (w_member_social
    // writes; ~60-day expiry). LinkedIn issues refresh tokens only to
    // approved partners, so near expiry the card flips to needs_reauth and
    // renewal is the SAME one-click dance — never a silent death.
    connect: {
      flavor: "oauth2",
      scopes: ["openid", "profile", "w_member_social"],
    },
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
    // The dance's yield IS this shape: the derived PAGE token + page id
    // (never the user token). s83b: oauth2 via the operator's own app in
    // Development mode — review-free for the self tenant; the B-int.4
    // App-Review wall concerns OTHER tenants and is untouched.
    credentials: z.object({ accessToken: z.string().min(1), pageId: z.string().min(1) }),
    connect: {
      flavor: "oauth2",
      scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"],
    },
  },
  instagram: {
    class: "social",
    driver: "instagram-text-refusal",
    label: "Instagram",
    credentials: z.object({ accessToken: z.string().min(1), igUserId: z.string().min(1) }),
    // s84: rides facebook's dance on the SAME Meta app — the yield is the
    // PAGE token plus the Page's linked IG professional-account id (one
    // extra Graph hop). Connecting and posting are different gates: the
    // driver stays a typed text-only refusal until the public assets origin
    // lands, and the card's capability note keeps saying so.
    connect: {
      flavor: "oauth2",
      scopes: [
        "pages_manage_posts",
        "pages_read_engagement",
        "pages_show_list",
        "instagram_basic",
        "instagram_content_publish",
      ],
    },
  },
  reddit: {
    class: "social",
    driver: "reddit-submit",
    label: "Reddit",
    // The oauth2 dance's yield: the exchange writes these, never a paste.
    // expiresAt rides the vault row's own column; the refresh tick renews.
    credentials: z.object({ accessToken: z.string().min(1), refreshToken: z.string().min(1) }),
    connect: { flavor: "oauth2", scopes: ["identity", "submit"] },
  },
  bluesky: {
    class: "social",
    driver: "bluesky-post",
    label: "Bluesky",
    // The platform's designed app-password pair — same shape as intel_bluesky
    // on purpose (one account can feed both seats), separate destination
    // because posting and intel are different consents.
    credentials: z.object({ identifier: z.string().min(1), appPassword: z.string().min(1) }),
    connect: { flavor: "app_password" },
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
