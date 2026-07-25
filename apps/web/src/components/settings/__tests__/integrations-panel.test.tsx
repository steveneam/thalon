// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import { server } from "@/lib/testing/server";
import type { WireIntegrationCard } from "@/lib/integrations/client";

/**
 * B-int.2 panel pins: honest states straight from the wire, the guided
 * mode-2 flow (steps → paste → connect → probe verdict), and the published
 * ledger with its way back on every row.
 */

function card(overrides: Partial<WireIntegrationCard>): WireIntegrationCard {
  return {
    destination: "x",
    class: "social",
    label: "X",
    driver: "x-v2-create-post",
    state: "not_connected",
    connectedAs: null,
    validatedAt: null,
    expiresAt: null,
    envOverride: false,
    fields: [{ key: "accessToken", optional: false }],
    ...overrides,
  };
}

const CARDS: WireIntegrationCard[] = [
  card({
    destination: "linkedin",
    label: "LinkedIn",
    driver: "linkedin-rest-posts",
    state: "connected",
    connectedAs: "Steven",
    validatedAt: "2026-07-25T09:00:00Z",
  }),
  card({ envOverride: true }),
  card({
    destination: "intel_youtube",
    class: "intel",
    label: "YouTube intel",
    driver: "youtube",
    state: "needs_reauth",
    fields: [{ key: "apiKey", optional: false }],
  }),
];

const PUBLISHED = {
  items: [
    {
      kind: "social" as const,
      platform: "linkedin",
      draftId: "d1",
      externalPostId: "urn:li:share:9",
      permalink: "https://www.linkedin.com/feed/update/urn:li:share:9",
      excerpt: "The first live post.",
      publishedAtMs: Date.parse("2026-07-25T09:00:00Z"),
    },
    {
      kind: "web" as const,
      draftId: "d2",
      slug: "the-honest-engine",
      title: "The honest engine",
      path: "/blog/the-honest-engine",
      publishedAtMs: Date.parse("2026-07-25T08:00:00Z"),
    },
  ],
  socialTotal: 1,
  webTotal: 1,
};

function wire(cards: WireIntegrationCard[] = CARDS): void {
  server.use(
    http.get("/api/integrations", () => HttpResponse.json({ cards })),
    http.get("/api/integrations/published", () => HttpResponse.json(PUBLISHED)),
  );
}

describe("IntegrationsPanel", () => {
  it("renders cards under their class groups with honest state badges and identity stamps", async () => {
    wire();
    render(<IntegrationsPanel />);

    expect(await screen.findByText("Social publishing")).toBeInTheDocument();
    expect(screen.getByText("Intel sources")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.getByText("Needs re-auth")).toBeInTheDocument();
    expect(screen.getByText(/as Steven/)).toBeInTheDocument();
    expect(screen.getByText("linkedin-rest-posts")).toBeInTheDocument();
    // The env-override honesty badge: the box env fills X's seat in this fixture.
    expect(screen.getByText("env override")).toBeInTheDocument();
  });

  it("walks the guided flow: steps, paste, connect — the probe verdict lands on the card", async () => {
    wire();
    let connectBody: unknown = null;
    server.use(
      http.post("/api/integrations/x/connect", async ({ request }) => {
        connectBody = await request.json();
        return HttpResponse.json({
          card: card({ state: "connected", connectedAs: "@mactechdish" }),
          probe: { outcome: "validated", connectedAs: "@mactechdish" },
        });
      }),
    );
    const user = userEvent.setup();
    render(<IntegrationsPanel />);

    await user.click(await screen.findByRole("button", { name: "Set up" }));
    expect(screen.getByText(/developer portal with write access/)).toBeInTheDocument();
    // Mode 1 is named honestly, not pretended.
    expect(screen.getByText(/One-click connect arrives/)).toBeInTheDocument();

    const connect = screen.getByRole("button", { name: "Connect" });
    expect(connect).toBeDisabled();
    await user.type(screen.getByLabelText(/Access token/), "tok-123");
    expect(connect).toBeEnabled();
    await user.click(connect);

    expect(await screen.findByText(/Verified — connected as @mactechdish/)).toBeInTheDocument();
    expect(connectBody).toEqual({ credentials: { accessToken: "tok-123" } });
  });

  it("a refused paste reads loud on the card, not silently green", async () => {
    wire();
    server.use(
      http.post("/api/integrations/x/connect", () =>
        HttpResponse.json({
          card: card({ state: "needs_reauth" }),
          probe: { outcome: "auth_failed", detail: "the platform answered HTTP 401" },
        }),
      ),
    );
    const user = userEvent.setup();
    render(<IntegrationsPanel />);

    await user.click(await screen.findByRole("button", { name: "Set up" }));
    await user.type(screen.getByLabelText(/Access token/), "dead");
    await user.click(screen.getByRole("button", { name: "Connect" }));

    expect(await screen.findByText(/refused the credential/)).toBeInTheDocument();
  });

  it("the published ledger renders both kinds with the way back on every row", async () => {
    wire();
    render(<IntegrationsPanel />);

    expect(await screen.findByText("The first live post.")).toBeInTheDocument();
    expect(screen.getByText("The honest engine")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open the linkedin post/i })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/feed/update/urn:li:share:9",
    );
    expect(screen.getByRole("link", { name: /open the blog post/i })).toHaveAttribute(
      "href",
      "/blog/the-honest-engine",
    );
  });
});
