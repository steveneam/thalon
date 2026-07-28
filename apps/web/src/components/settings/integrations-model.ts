import type {
  WireDestinationClass,
  WireIntegrationCard,
  WireProbeOutcome,
} from "@/lib/integrations/client";
import type { WorkspaceStatus } from "@/lib/workspace/types";
import { timeAgo, timeUntil } from "@/lib/workspace/format";

/**
 * Pure derivations for the Integrations surface (the exact-mock rebuild of
 * Integrations.dc.html). The engine already derives every card's STATE
 * (packages/engine integrations/cards.ts) — nothing here re-derives it; this
 * file only decides how one card's truth reads in the sheet's chrome, so a
 * state word can never be softened to fit the fixture.
 */

/**
 * The sheet's platform glyph per destination. Destination keys are the
 * vault's own vocabulary (`website_hosted`, `intel_youtube`), a different
 * namespace from the platform ids `platformLabel` covers — an unknown key
 * still renders (its first two letters) rather than disappearing.
 */
const GLYPHS: Readonly<Record<string, string>> = {
  linkedin: "in",
  x: "𝕏",
  facebook: "f",
  instagram: "ig",
  reddit: "rd",
  bluesky: "bs",
  website_hosted: "bl",
  website_wordpress: "wp",
  website_ghost: "gh",
  website_webhook: "wh",
  newsletter_resend: "@",
  intel_youtube: "yt",
  intel_bluesky: "bs",
};

export function platformGlyph(destination: string): string {
  return GLYPHS[destination] ?? destination.replace(/^[a-z]+_/, "").slice(0, 2);
}

/** What this class of destination DOES with a credential — the honest verb. */
const ROLE_VERB: Record<WireDestinationClass, string> = {
  social: "Posting",
  website: "Publishing",
  newsletter: "Sending",
  intel: "Reading",
};

/** A stored credential exists (however healthy) — the actions that need one. */
export function isConnected(card: WireIntegrationCard): boolean {
  return card.state === "connected" || card.state === "needs_reauth" || card.state === "expiring";
}

/**
 * CAPABILITY is a different fact from credential health, and the card used to
 * state only the second. Instagram's driver refuses EVERY publish
 * (`InstagramTextOnlyUnsupportedError` — the official content-publish flow
 * requires media, and faking one would alter the judged body), yet its card
 * offered the same guided paste as LinkedIn's, validated for real, and then
 * read "Posting as @handle". So an operator could spend a real Meta app, a
 * content-publishing permission and a token on a destination that cannot
 * post, and nothing said so in words.
 *
 * The sheet already had the answer and the rebuild dropped it — the mock's
 * Instagram card reads "Almost ready · Needs public image URLs — shipping —
 * then the Graph connect" (Integrations.dc.html:77-79). This restores that
 * line in the sheet's own voice, at TODAY's truth: the refusal is
 * unconditional, media included, so the note must not promise that an image
 * post would go out.
 *
 * Keyed by destination rather than by driver name so a driver swap does not
 * silently drop the caveat with it.
 */
const CAPABILITY_NOTES: Readonly<Record<string, string>> = {
  instagram:
    "Almost ready — the content-publish flow needs image or video media, and this driver refuses every post until that lands. Connecting stores the credential; nothing posts from here yet.",
};

/** The destination's capability caveat, or null where the driver can do its class's job. */
export function capabilityNote(card: WireIntegrationCard): string | null {
  return CAPABILITY_NOTES[card.destination] ?? null;
}

export interface StatePill {
  text: string;
  className: string;
}

/**
 * The card's state pill. The one softening the surface must never do is
 * calling an env-filled seat "Not connected" (the s70 founder catch): the
 * environment posts today even with no vault row, so it gets its own honest
 * pill — the sheet's own words for exactly this case.
 */
export function statePill(card: WireIntegrationCard): StatePill {
  // The plan gate is the hard stop and outranks the env seat: an entitlement
  // that is off means the product will not post, whatever keys the box holds.
  if (card.state === "plan_gated") return { text: "Not on your plan", className: "pill pill-idle" };
  if (card.envOverride) return { text: "Connected via env", className: "pill pill-idle" };
  switch (card.state) {
    case "connected":
      return { text: "Connected", className: "pill pill-ok" };
    case "needs_reauth":
      return { text: "Needs re-auth", className: "pill pill-warn" };
    case "expiring":
      return { text: "Expiring soon", className: "pill pill-warn" };
    case "review_pending":
      return { text: "Awaiting platform review", className: "pill pill-idle" };
    case "not_connected":
      return { text: "Not connected", className: "pill pill-idle" };
  }
}

/**
 * The ARMING pill (s78). The card already enumerated every other rung of
 * "will this post" — the plan gate, expiry, re-auth, the env seat — which
 * made it read as the complete ladder while omitting the top rung. A
 * connected credential and an armed one are different facts, and only the
 * second decides whether anything goes out.
 *
 * Worded, never colour-only, and shown ONLY where a credential exists: an
 * unconnected seat's arming state is not yet a question the operator has.
 */
export function armedPill(card: WireIntegrationCard): StatePill | null {
  if (card.armed === null || !isConnected(card)) return null;
  return card.armed
    ? { text: "Armed", className: "pill pill-ok" }
    : { text: "Not armed", className: "pill pill-warn" };
}

/**
 * The card's one sub-line: who it acts as, when it was last verified, and
 * which driver consumes the credential (visible provenance — the driver name
 * is how a live post is traced back to a seat).
 */
export function subLine(card: WireIntegrationCard, now: number = Date.now()): string {
  const parts: string[] = [];
  if (card.envOverride && card.state !== "plan_gated") {
    // The env seat never hides what the VAULT row is doing — an operator who
    // rotates a key needs to know the stored one is broken underneath it.
    if (card.state === "needs_reauth") {
      parts.push(
        "The box environment fills this seat — the stored vault row itself needs re-authorizing",
      );
    } else if (card.state === "expiring") {
      parts.push("The box environment fills this seat — the stored vault row is expiring");
    } else if (isConnected(card)) {
      parts.push("The box environment fills this seat and takes precedence over the vault row");
    } else {
      parts.push("Live on the box environment's keys — connect here to move them into the vault");
    }
  } else {
    switch (card.state) {
      case "connected":
        // A destination whose driver cannot do its class's job must not claim
        // the class verb: "Posting as @handle" is a present-tense assertion,
        // and on Instagram it is false. Name the identity instead, and let
        // the capability note say why.
        parts.push(
          card.connectedAs
            ? `${capabilityNote(card) ? "Connected" : ROLE_VERB[card.class]} as ${card.connectedAs}`
            : "Connected",
        );
        break;
      case "expiring":
        parts.push(
          card.expiresAt
            ? `The stored credential expires ${timeUntil(card.expiresAt, now)}`
            : "The stored credential is expiring",
        );
        break;
      case "needs_reauth":
        parts.push("The platform refused the stored credential — reconnect to fix it");
        break;
      case "plan_gated":
        parts.push("Not on your plan — connecting stays closed until the entitlement is on");
        break;
      case "review_pending":
        parts.push("Waiting on the platform's app review — nothing to do here yet");
        break;
      case "not_connected":
        parts.push(
          card.connectFlavor === "oauth2"
            ? "Not connected — connecting is a click-through consent, no tokens to paste"
            : "Not connected — guided setup is a paste and a read-only ping",
        );
        break;
    }
  }
  if (card.validatedAt) parts.push(`verified ${timeAgo(card.validatedAt, now)}`);
  else if (isConnected(card)) parts.push("never validated");
  parts.push(card.driver);
  return parts.join(" · ");
}

export interface CardAction {
  key: "validate" | "connect" | "disconnect" | "blog";
  label: string;
  variant: "btn-ghost" | "btn-quiet";
}

/**
 * The sheet's action row per state — Validate/Disconnect on a live seat,
 * "Move into vault" where the environment is the thing that posts, "Set up"
 * on an empty one. A card the plan or a platform review closes offers no
 * action at all rather than a button that cannot work.
 */
export function cardActions(card: WireIntegrationCard): CardAction[] {
  if (card.state === "plan_gated" || card.state === "review_pending") return [];
  const connected = isConnected(card);
  const out: CardAction[] = [];
  if (connected) out.push({ key: "validate", label: "Validate", variant: "btn-ghost" });
  if (!connected) {
    out.push({
      key: "connect",
      label: card.envOverride ? "Move into vault" : "Set up",
      variant: "btn-ghost",
    });
  } else if (card.state !== "connected") {
    out.push({ key: "connect", label: "Reconnect", variant: "btn-ghost" });
  }
  if (connected) out.push({ key: "disconnect", label: "Disconnect", variant: "btn-quiet" });
  if (card.destination === "website_hosted" && connected) {
    out.push({ key: "blog", label: "Open /blog ↗", variant: "btn-ghost" });
  }
  return out;
}

/** A probe verdict, rendered verbatim — the platform's own refusal is the evidence. */
export function probeLine(probe: WireProbeOutcome): { text: string; tone: "ok" | "warn" | "bad" } {
  switch (probe.outcome) {
    case "validated":
      return {
        text: probe.connectedAs ? `Verified — connected as ${probe.connectedAs}` : "Verified",
        tone: "ok",
      };
    case "auth_failed":
      return {
        text: `The platform refused the credential — ${probe.detail ?? "auth failed"}`,
        tone: "bad",
      };
    case "unreachable":
      return {
        text: probe.detail ?? "The platform could not be reached — nothing changed.",
        tone: "warn",
      };
    case "unsupported":
      return {
        text: probe.detail ?? "No read-only probe exists for this destination.",
        tone: "warn",
      };
  }
}

export interface SeatRow {
  label: string;
  value: string;
}

/** How a seat's model is actually reached — the id names it, the transport pays for it. */
function transport(model: string, gateway: WorkspaceStatus["seams"]["gateway"]): string {
  if (model.startsWith("claude-cli/")) return "via your subscription";
  return gateway === "configured"
    ? "via the gateway · metered per tenant"
    : "gateway unconfigured — this seat can’t run";
}

/**
 * The sheet's three model seats, filled from the platform's env choke point.
 * The judge is ONE seat that runs two passes, so its row names both models
 * when they differ rather than inventing a fourth seat the engine hasn't got.
 */
export function seatRows(status: WorkspaceStatus): SeatRow[] {
  const { models, seams } = status;
  const judge =
    models.judgeScreen === models.judgeFinal
      ? `${models.judgeFinal} · ${transport(models.judgeFinal, seams.gateway)}`
      : `screen ${models.judgeScreen} · final ${models.judgeFinal} · ${transport(models.judgeFinal, seams.gateway)}`;
  return [
    { label: "Draft seat", value: `${models.draft} · ${transport(models.draft, seams.gateway)}` },
    { label: "Judge seat", value: judge },
    {
      label: "Embed seat",
      value: `${models.embedding} · ${transport(models.embedding, seams.gateway)}`,
    },
  ];
}

/** Paste-field labels by schema key; a key without an entry renders as itself. */
export const FIELD_LABELS: Readonly<Record<string, string>> = {
  accessToken: "Access token",
  pageId: "Page ID",
  igUserId: "Account ID",
  baseUrl: "Site URL",
  username: "Username",
  applicationPassword: "Application password",
  adminApiUrl: "Admin API URL",
  adminApiKey: "Admin API key",
  url: "Endpoint URL",
  secret: "Signing secret",
  apiKey: "API key",
  identifier: "Handle",
  appPassword: "App password",
};

/** Secret-shaped keys render as password inputs. */
export const SECRET_KEYS = new Set([
  "accessToken",
  "applicationPassword",
  "adminApiKey",
  "secret",
  "apiKey",
  "appPassword",
]);

/**
 * The guided (mode 2) step lists — authored generic and platform-neutral:
 * every platform's portal differs in chrome, not in shape (an app, a grant,
 * a token, a paste). The validate ping after the paste is what makes the
 * card honest. Carried through the rebuild unchanged (B-int.2 copy).
 */
export const GUIDED_STEPS: Readonly<Record<string, string[]>> = {
  linkedin: [
    "Create (or open) an app in the platform's developer portal.",
    "Add the member-posting and image-upload products and request access where gated.",
    "Generate a member access token carrying those scopes with the portal's token tool.",
    "Paste it below — a read-only ping verifies it before anything can post.",
  ],
  x: [
    "Create (or open) an app in the platform's developer portal with write access.",
    "Generate a user access token for the account that will post.",
    "Paste it below — a read-only ping verifies it before anything can post.",
  ],
  facebook: [
    "Create (or open) an app in the platform's developer portal and connect your Page.",
    "Grant the Page posting and photo permissions.",
    "Generate a long-lived Page access token.",
    "Paste the token and your Page ID below.",
  ],
  instagram: [
    "Connect the account to a Page in the platform's developer portal.",
    "Grant the content-publishing permission and generate an access token.",
    "Paste the token and the account ID below.",
  ],
  reddit: [
    "Continue to the platform — you'll approve access in your own browser session.",
    "The permissions asked for: read your identity, submit posts. Nothing else.",
    "Approving brings you straight back here; the tokens land sealed in the vault and refresh themselves.",
  ],
  bluesky: [
    "In the platform's settings, create an app password (never your account password).",
    "Paste your handle and the app password below — a read-only ping verifies them.",
  ],
  website_hosted: [
    "No credentials needed — connecting is your opt-in to the hosted blog. Approved articles can then publish to it.",
  ],
  website_wordpress: [
    "In your site's admin, create an Application Password for your user (Users → Profile).",
    "Paste your site URL, username, and that password below.",
  ],
  website_ghost: [
    "In your site's admin, add a custom integration (Settings → Integrations) to get an Admin API key.",
    "Paste the Admin API URL and the key below.",
  ],
  website_webhook: [
    "Stand up an endpoint on your side that accepts published content as a POST.",
    "Paste its URL — and a signing secret if you want payloads signed.",
    "No ping fires on connect (firing your automation is not a probe) — the connection validates on first publish.",
  ],
  newsletter_resend: [
    "Create an API key in your email provider's dashboard.",
    "Paste it below — a read-only ping verifies it.",
  ],
  intel_youtube: [
    "In the platform's cloud console, enable the Data API and create an API key.",
    "Paste it below — a read-only ping verifies it.",
  ],
  intel_bluesky: [
    "In the platform's settings, create an app password (never your account password).",
    "Paste your handle and the app password below.",
  ],
};
