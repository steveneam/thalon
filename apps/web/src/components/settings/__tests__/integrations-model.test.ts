import { describe, expect, it } from "vitest";
import {
  cardActions,
  platformGlyph,
  probeLine,
  seatRows,
  statePill,
  subLine,
} from "../integrations-model";
import type { WireIntegrationCard } from "@/lib/integrations/client";
import type { WorkspaceStatus } from "@/lib/workspace/types";

const NOW = Date.parse("2026-07-25T12:00:00Z");

function card(overrides: Partial<WireIntegrationCard> = {}): WireIntegrationCard {
  return {
    destination: "linkedin",
    class: "social",
    label: "LinkedIn",
    driver: "linkedin-rest-posts",
    state: "not_connected",
    connectedAs: null,
    validatedAt: null,
    expiresAt: null,
    envOverride: false,
    fields: [{ key: "accessToken", optional: false }],
    ...overrides,
  };
}

function status(overrides: Partial<WorkspaceStatus["models"]> = {}, gateway: "configured" | "unconfigured" = "configured"): WorkspaceStatus {
  return {
    seams: {
      db: "pglite",
      objectStore: "local",
      queue: "inline",
      auth: "dev",
      gateway,
      tracing: "unconfigured",
      dataDir: ".data",
    },
    drivers: { render: "hyperframes", transcript: "caption-file", searchIntel: "fake" },
    models: {
      draft: "claude-cli/opus-5",
      judgeScreen: "claude-cli/opus-5",
      judgeFinal: "claude-cli/opus-5",
      embedding: "openai/text-embedding-3-small",
      ...overrides,
    },
    budget: { tenantDailyTokens: 2_000_000 },
    tenantSlug: "self",
  };
}

/**
 * The honesty rules of the Integrations surface, as pure math. The engine
 * derives every card's STATE; these pin how that state is allowed to READ —
 * the place a surface could quietly soften a word and nobody would notice.
 */
describe("integrations model (exact-mock rebuild)", () => {
  it("the plan gate outranks the env seat — an off entitlement is the hard stop", () => {
    const gated = card({ state: "plan_gated", envOverride: true });
    expect(statePill(gated).text).toBe("Not on your plan");
    expect(subLine(gated, NOW)).toMatch(/^Not on your plan — connecting stays closed/);
    expect(cardActions(gated)).toEqual([]);
  });

  it("an env-filled seat never reads 'Not connected', and never hides a broken vault row", () => {
    expect(statePill(card({ envOverride: true })).text).toBe("Connected via env");
    expect(subLine(card({ envOverride: true }), NOW)).toBe(
      "Live on the box environment's keys — connect here to move them into the vault · linkedin-rest-posts",
    );
    expect(subLine(card({ envOverride: true, state: "needs_reauth" }), NOW)).toMatch(
      /the stored vault row itself needs re-authorizing · never validated · linkedin-rest-posts/,
    );
    // And the door it offers is the one that fixes it.
    expect(cardActions(card({ envOverride: true })).map((a) => a.label)).toEqual(["Move into vault"]);
  });

  it("a connected card stamps who it acts as, when it was verified, and which driver runs it", () => {
    const connected = card({
      state: "connected",
      connectedAs: "Steven",
      validatedAt: "2026-07-25T09:00:00Z",
    });
    expect(subLine(connected, NOW)).toBe("Posting as Steven · verified 3h ago · linkedin-rest-posts");
    // A connected seat that was never probed says exactly that.
    expect(subLine(card({ state: "connected", connectedAs: "Steven" }), NOW)).toBe(
      "Posting as Steven · never validated · linkedin-rest-posts",
    );
    // The verb follows what the destination actually does with the credential.
    expect(
      subLine(
        card({ class: "intel", driver: "bluesky", state: "connected", connectedAs: "@handle" }),
        NOW,
      ),
    ).toMatch(/^Reading as @handle/);
  });

  it("actions follow the state: validate+disconnect on a live seat, reconnect on a sick one", () => {
    expect(cardActions(card({ state: "connected" })).map((a) => a.label)).toEqual([
      "Validate",
      "Disconnect",
    ]);
    expect(cardActions(card({ state: "needs_reauth" })).map((a) => a.label)).toEqual([
      "Validate",
      "Reconnect",
      "Disconnect",
    ]);
    expect(cardActions(card()).map((a) => a.label)).toEqual(["Set up"]);
    expect(cardActions(card({ state: "review_pending" }))).toEqual([]);
    // The hosted blog carries the sheet's own door out to what it published.
    expect(
      cardActions(
        card({ destination: "website_hosted", class: "website", state: "connected" }),
      ).map((a) => a.label),
    ).toContain("Open /blog ↗");
  });

  it("a probe verdict renders the platform's own words, never a friendly paraphrase", () => {
    expect(
      probeLine({ outcome: "auth_failed", detail: "the platform answered HTTP 426" }),
    ).toEqual({
      text: "The platform refused the credential — the platform answered HTTP 426",
      tone: "bad",
    });
    expect(probeLine({ outcome: "validated", connectedAs: "@x" }).tone).toBe("ok");
    expect(probeLine({ outcome: "unreachable", detail: "network down" }).tone).toBe("warn");
  });

  it("the glyph covers the vault's own destination vocabulary, and degrades rather than vanishing", () => {
    expect(platformGlyph("linkedin")).toBe("in");
    expect(platformGlyph("website_hosted")).toBe("bl");
    expect(platformGlyph("intel_bluesky")).toBe("bs");
    expect(platformGlyph("mastodon")).toBe("ma");
  });

  it("the seats name their transport — one judge seat, both passes when they differ", () => {
    const rows = seatRows(status());
    expect(rows.map((r) => r.label)).toEqual(["Draft seat", "Judge seat", "Embed seat"]);
    expect(rows[0].value).toBe("claude-cli/opus-5 · via your subscription");
    expect(rows[1].value).toBe("claude-cli/opus-5 · via your subscription");
    expect(rows[2].value).toBe("openai/text-embedding-3-small · via the gateway · metered per tenant");

    const split = seatRows(status({ judgeScreen: "meta/llama-3.3-70b" }));
    expect(split[1].value).toBe(
      "screen meta/llama-3.3-70b · final claude-cli/opus-5 · via your subscription",
    );

    // An unconfigured gateway is stated, not implied by a blank.
    expect(seatRows(status({}, "unconfigured"))[2].value).toBe(
      "openai/text-embedding-3-small · gateway unconfigured — this seat can’t run",
    );
  });
});
