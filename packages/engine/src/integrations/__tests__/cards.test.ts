import { DESTINATION_KEYS, tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle } from "@thalon/db";
import { readEnv, type ThalonEnv } from "@thalon/platform";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deriveCardState, listIntegrationCards, pasteFields } from "../cards";
import { connectDestination, type VaultDeps } from "../vault";

/**
 * B-int.2 pins: the card read model — complete over the registry, states
 * derived by ONE rule, paste fields read off the connect schemas (never
 * hand-listed), and plan-gating honest even over a stored connection.
 */

const MASTER_B64 = Buffer.alloc(32, 7).toString("base64");
const ALL_ON = { sites_templates: true, crm: true, social_publishing: true };
const NOW = new Date("2026-07-25T10:00:00Z");

let handle: DbHandle;
let ctx: TenantCtx;
let env: ThalonEnv;

function deps(): VaultDeps {
  return { repos: handle.repos, ctx, env };
}

beforeEach(async () => {
  handle = await openTestDb();
  const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self" });
  ctx = tenantCtx(tenant.id);
  env = readEnv({ THALON_VAULT_MASTER_KEY: MASTER_B64 });
});

afterEach(async () => {
  await handle.close();
});

describe("deriveCardState (the one rule)", () => {
  const connected = { status: "connected", expiresAt: null };

  it("walks the ladder: plan_gated > not_connected > needs_reauth > expiring > connected", () => {
    expect(deriveCardState({ stored: connected, entitled: false, now: NOW })).toBe("plan_gated");
    expect(deriveCardState({ stored: null, entitled: true, now: NOW })).toBe("not_connected");
    expect(
      deriveCardState({ stored: { status: "needs_reauth", expiresAt: null }, entitled: true, now: NOW }),
    ).toBe("needs_reauth");
    expect(deriveCardState({ stored: connected, entitled: true, now: NOW })).toBe("connected");
  });

  it("a token inside the 14-day horizon reads expiring; outside it, connected", () => {
    const inside = new Date(NOW.getTime() + 13 * 24 * 60 * 60 * 1000);
    const outside = new Date(NOW.getTime() + 15 * 24 * 60 * 60 * 1000);
    expect(
      deriveCardState({ stored: { status: "connected", expiresAt: inside }, entitled: true, now: NOW }),
    ).toBe("expiring");
    expect(
      deriveCardState({ stored: { status: "connected", expiresAt: outside }, entitled: true, now: NOW }),
    ).toBe("connected");
  });
});

describe("pasteFields (schema-derived, never hand-listed)", () => {
  it("reads required and optional fields off the registry's connect shapes", () => {
    expect(pasteFields("facebook")).toEqual([
      { key: "accessToken", optional: false },
      { key: "pageId", optional: false },
    ]);
    expect(pasteFields("website_webhook")).toEqual([
      { key: "url", optional: false },
      { key: "secret", optional: true },
    ]);
    // No secret collected — connecting IS the opt-in.
    expect(pasteFields("website_hosted")).toEqual([]);
  });
});

describe("listIntegrationCards", () => {
  it("is COMPLETE over the registry, in registry order, absent rows reading not_connected", async () => {
    const cards = await listIntegrationCards(deps(), { features: ALL_ON, now: NOW });
    expect(cards.map((c) => c.destination)).toEqual(DESTINATION_KEYS);
    for (const card of cards) expect(card.state).toBe("not_connected");
  });

  it("folds vault rows in: a connected destination carries its identity and stamp fields", async () => {
    await connectDestination(deps(), {
      destination: "linkedin",
      credentials: { accessToken: "tok" },
      connectedAs: "Steven",
    });
    const cards = await listIntegrationCards(deps(), { features: ALL_ON, now: NOW });
    const linkedin = cards.find((c) => c.destination === "linkedin");
    expect(linkedin?.state).toBe("connected");
    expect(linkedin?.connectedAs).toBe("Steven");
    expect(cards.find((c) => c.destination === "x")?.state).toBe("not_connected");
  });

  it("plan-gating is honest even over a stored connection — and gates ONLY the social class today", async () => {
    await connectDestination(deps(), {
      destination: "linkedin",
      credentials: { accessToken: "tok" },
    });
    const cards = await listIntegrationCards(deps(), {
      features: { ...ALL_ON, social_publishing: false },
      now: NOW,
    });
    for (const card of cards) {
      expect(card.state).toBe(card.class === "social" ? "plan_gated" : "not_connected");
    }
  });

  it("names the env override honestly: a destination whose credential seat is env-filled says so", async () => {
    env = readEnv({
      THALON_VAULT_MASTER_KEY: MASTER_B64,
      SOCIAL_X_ACCESS_TOKEN: "env-tok",
      YOUTUBE_API_KEY: "env-yt",
      RESEND_API_KEY: "env-resend",
    });
    const cards = await listIntegrationCards(deps(), { features: ALL_ON, now: NOW });
    expect(cards.find((c) => c.destination === "x")?.envOverride).toBe(true);
    expect(cards.find((c) => c.destination === "linkedin")?.envOverride).toBe(false);
    // B-int.3: every vault-first family reports its override off the ONE
    // seat table — intel and newsletter included, never hand-listed.
    expect(cards.find((c) => c.destination === "intel_youtube")?.envOverride).toBe(true);
    expect(cards.find((c) => c.destination === "newsletter_resend")?.envOverride).toBe(true);
    expect(cards.find((c) => c.destination === "intel_bluesky")?.envOverride).toBe(false);
    // Website destinations carry no env seats — never an override.
    expect(cards.find((c) => c.destination === "website_wordpress")?.envOverride).toBe(false);
  });

  it("never leaks an envelope field onto a card", async () => {
    await connectDestination(deps(), {
      destination: "linkedin",
      credentials: { accessToken: "SECRET-TOKEN" },
    });
    const cards = await listIntegrationCards(deps(), { features: ALL_ON, now: NOW });
    expect(JSON.stringify(cards)).not.toContain("SECRET-TOKEN");
    expect(JSON.stringify(cards)).not.toContain("ciphertext");
  });
});

/**
 * s78 — ARMED on the card. A credential can be perfectly healthy and post
 * nothing, and the card enumerated every OTHER rung of "will this post" (the
 * plan gate, expiry, re-auth, the env seat), which made it read as the
 * complete ladder while omitting the top one.
 *
 * The derivation itself is pure and lives with the publish ratchet that
 * shares it (`socialArmed`, social-arming.test.ts) — two spellings of
 * "armed" would be two truths. This pins the WIRING: that the card carries
 * the fact, and that only destinations which can post claim it.
 */
describe("listIntegrationCards — the arming rung (s78)", () => {
  it("carries armed + its reason on social seats, and claims nothing on the rest", async () => {
    await connectDestination(deps(), {
      destination: "linkedin",
      credentials: { accessToken: "tok-linkedin-value" },
      connectedAs: "@thalon",
    });

    const cards = await listIntegrationCards(deps(), { features: ALL_ON, now: NOW });
    const linkedin = cards.find((c) => c.destination === "linkedin");
    expect(linkedin?.state).toBe("connected");
    // Connected, and NOT armed — the two facts the card used to conflate.
    expect(linkedin?.armed).toBe(false);
    expect(linkedin?.armedReason).toContain("social block");

    // Named in the tenant's social block, the same seat arms.
    const armed = await listIntegrationCards(deps(), {
      features: ALL_ON,
      now: NOW,
      // `armState` is the QUEUE's per-destination gate (s102) and is a
      // different question from this card's `armed` — an entry in the block
      // still arms the platform for a manual publish whatever the tick may do.
      // The same holds for A2's `postingScope` (s103): the tick's scope has no
      // say over whether an operator may publish this platform by hand.
      socialConfig: { linkedin: { maxPostsPerDay: 1, armState: "off" }, postingScope: "selective" },
    });
    expect(armed.find((c) => c.destination === "linkedin")?.armed).toBe(true);

    // Nothing that cannot post makes an arming claim.
    for (const card of cards.filter((c) => c.class !== "social")) {
      expect(card.armed).toBeNull();
      expect(card.armedReason).toBeNull();
    }
  });
});
