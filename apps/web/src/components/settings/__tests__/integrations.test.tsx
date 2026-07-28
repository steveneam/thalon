// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { Integrations } from "@/components/settings/integrations";
import type { WireIntegrationCard } from "@/lib/integrations/client";
import { server } from "@/lib/testing/server";

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
    armed: null,
    armedReason: null,
    connectFlavor: "manual",
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
  // The dogfood tenant's X: env 1.0a seats post today with no vault row.
  card({ envOverride: true }),
  card({
    destination: "website_hosted",
    class: "website",
    label: "Hosted blog",
    driver: "own-site-blog",
    state: "connected",
    fields: [],
  }),
  card({
    destination: "intel_youtube",
    class: "intel",
    label: "YouTube intel",
    driver: "youtube",
    fields: [{ key: "apiKey", optional: false }],
  }),
  card({
    destination: "instagram",
    label: "Instagram",
    driver: "instagram-text-refusal",
    state: "plan_gated",
    fields: [
      { key: "accessToken", optional: false },
      { key: "igUserId", optional: false },
    ],
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

/** The card for one destination — the grid repeats the same class names. */
function destinationCard(label: string): HTMLElement {
  return screen.getByText(label, { selector: ".int-name" }).closest(".int-card") as HTMLElement;
}

/**
 * STEP 2 of the two-step rebuild: the sheet's bands now carry the engine's
 * own card derivation. These pin the honesty rules of the surface the
 * kickoff calls honesty-critical — a softened state word, an env-filled seat
 * reading "Not connected", or a swallowed platform refusal is a failure.
 */
describe("Integrations (exact-mock rebuild — Integrations.dc.html)", () => {
  it("renders the sheet's bands with the engine's cards behind them", async () => {
    wire();
    const { container } = render(<Integrations />);

    expect(container.querySelector(".content.settings-surface")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Settings ›" })).toHaveAttribute("href", "/app/settings");
    expect(screen.getByRole("heading", { name: "Integrations" })).toHaveClass("t-headline");

    expect(await screen.findByText("LinkedIn", { selector: ".int-name" })).toBeInTheDocument();
    expect(container.querySelectorAll(".int-grid > .int-card")).toHaveLength(CARDS.length);

    const linkedin = destinationCard("LinkedIn");
    expect(within(linkedin).getByText("in")).toHaveClass("plat-ico");
    expect(within(linkedin).getByText("Connected")).toHaveClass("pill", "pill-ok");
    // connectedAs stamps the card, and the driver keeps the provenance visible.
    expect(linkedin.querySelector(".int-sub")?.textContent).toMatch(
      /Posting as Steven · verified .* · linkedin-rest-posts/,
    );
    expect(within(linkedin).getByRole("button", { name: "Validate" })).toHaveClass("btn", "btn-ghost");
    expect(within(linkedin).getByRole("button", { name: "Disconnect" })).toHaveClass("btn", "btn-quiet");

    // The hosted blog keeps the sheet's own door out to what it publishes.
    expect(within(destinationCard("Hosted blog")).getByRole("link", { name: "Open /blog ↗" })).toHaveAttribute(
      "href",
      "/blog",
    );
  });

  it("an env-filled seat says so — it never reads 'Not connected' (the s70 founder catch)", async () => {
    wire();
    render(<Integrations />);

    const x = destinationCard(await screen.findByText("X", { selector: ".int-name" }).then(() => "X"));
    expect(within(x).getByText("Connected via env")).toHaveClass("pill", "pill-idle");
    expect(x.querySelector(".int-sub")?.textContent).toMatch(
      /Live on the box environment's keys — connect here to move them into the vault/,
    );
    // The sheet's own words for this case, and the door that fixes it.
    expect(within(x).getByRole("button", { name: "Move into vault" })).toBeInTheDocument();
    expect(within(x).queryByText("Not connected")).not.toBeInTheDocument();

    // A destination genuinely without a credential is the one that says so.
    expect(within(destinationCard("YouTube intel")).getByText("Not connected")).toBeInTheDocument();
  });

  it("a plan-gated card offers no action instead of a button that cannot work", async () => {
    wire();
    render(<Integrations />);

    const instagram = destinationCard(
      await screen.findByText("Instagram", { selector: ".int-name" }).then(() => "Instagram"),
    );
    expect(within(instagram).getByText("Not on your plan")).toBeInTheDocument();
    expect(within(instagram).queryByRole("button")).not.toBeInTheDocument();
  });

  it("a validate failure prints the platform's own refusal — the versioned-pin proof, verbatim", async () => {
    wire();
    server.use(
      http.post("/api/integrations/linkedin/validate", () =>
        HttpResponse.json({
          card: CARDS[0],
          probe: {
            outcome: "auth_failed",
            detail: "the platform answered HTTP 426 — the pinned API version is retired",
          },
        }),
      ),
    );
    const user = userEvent.setup();
    render(<Integrations />);

    await screen.findByText("LinkedIn", { selector: ".int-name" });
    await user.click(within(destinationCard("LinkedIn")).getByRole("button", { name: "Validate" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      /refused the credential — the platform answered HTTP 426 — the pinned API version is retired/,
    );
  });

  it("walks the guided flow: the sheet's action opens it, the paste connects, the probe lands", async () => {
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
    const { container } = render(<Integrations />);

    await screen.findByText("X", { selector: ".int-name" });
    // At rest the sheet draws no flow — it is state behind the card's action.
    expect(container.querySelector(".connect-body")).toBeNull();

    await user.click(within(destinationCard("X")).getByRole("button", { name: "Move into vault" }));
    expect(screen.getByText("Connect X")).toBeInTheDocument();
    expect(screen.getByText(/developer portal with write access/)).toBeInTheDocument();
    // Mode 1 is named honestly, not pretended.
    expect(screen.getByText(/One-click connect arrives/)).toBeInTheDocument();

    const connect = screen.getByRole("button", { name: "Connect" });
    expect(connect).toBeDisabled();
    await user.type(screen.getByLabelText(/Access token/), "tok-123");
    expect(connect).toBeEnabled();
    await user.click(connect);

    expect(await screen.findByText("Verified — connected as @mactechdish")).toBeInTheDocument();
    expect(connectBody).toEqual({ credentials: { accessToken: "tok-123" } });
    expect(container.querySelector(".connect-body")).toBeNull();
  });

  it("disconnect confirms first and says what it destroys", async () => {
    wire();
    let deleted = false;
    server.use(
      http.delete("/api/integrations/linkedin", () => {
        deleted = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    render(<Integrations />);

    await screen.findByText("LinkedIn", { selector: ".int-name" });
    const linkedin = destinationCard("LinkedIn");
    await user.click(within(linkedin).getByRole("button", { name: "Disconnect" }));
    expect(within(linkedin).getByText(/The sealed credential is deleted; the ledger remembers/)).toBeInTheDocument();
    expect(deleted).toBe(false);

    // The card action stepped aside for the confirm — one Disconnect on screen.
    await user.click(within(linkedin).getByRole("button", { name: "Disconnect" }));
    expect(deleted).toBe(true);
  });

  it("the published ledger opens from the sheet's own header door, with the way back on every row", async () => {
    wire();
    const user = userEvent.setup();
    render(<Integrations />);

    const door = await screen.findByRole("button", { name: /Published · 2 items/ });
    // Closed at rest — the sheet draws a link, not a ledger.
    expect(screen.queryByText("The first live post.")).not.toBeInTheDocument();

    await user.click(door);
    expect(screen.getByText("The first live post.")).toBeInTheDocument();
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

  it("the model seats read the platform's own choke point — one judge seat, both passes named", async () => {
    wire();
    server.use(
      http.get("/api/app/status", () =>
        HttpResponse.json({
          seams: {
            db: "pglite",
            objectStore: "local",
            queue: "inline",
            auth: "dev",
            gateway: "configured",
            tracing: "unconfigured",
            dataDir: ".data",
          },
          drivers: { render: "hyperframes", transcript: "caption-file", searchIntel: "fake" },
          models: {
            draft: "claude-cli/opus-5",
            judgeScreen: "meta/llama-3.3-70b",
            judgeFinal: "anthropic/claude-sonnet-4.5",
            embedding: "openai/text-embedding-3-small",
          },
          budget: { tenantDailyTokens: 2_000_000 },
          tenantSlug: "self",
        }),
      ),
    );
    render(<Integrations />);

    expect(await screen.findByText("3 model seats")).toBeInTheDocument();
    expect(screen.getByText("claude-cli/opus-5 · via your subscription")).toBeInTheDocument();
    // The judge is ONE seat that runs two passes — both named, no invented seat.
    expect(
      screen.getByText(
        "screen meta/llama-3.3-70b · final anthropic/claude-sonnet-4.5 · via the gateway · metered per tenant",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Draft seat")).toBeInTheDocument();
    expect(screen.getByText("Judge seat")).toBeInTheDocument();
    expect(screen.getByText("Embed seat")).toBeInTheDocument();
  });

  it("a failed cards read is an alert with retry, never a disconnected-looking workspace", async () => {
    server.use(
      http.get("/api/integrations", () => HttpResponse.error()),
      http.get("/api/integrations/published", () => HttpResponse.json(PUBLISHED)),
    );
    const { container } = render(<Integrations />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/read failure, not a disconnected workspace/);
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(container.querySelector(".int-grid")).toBeNull();
  });

  it("carries no legacy bridge styling — the rebuild speaks the sheet's own classes", async () => {
    wire();
    const { container } = render(<Integrations />);

    await screen.findByText("LinkedIn", { selector: ".int-name" });
    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-muted"]')).toBeNull();
    expect(container.querySelector('[class*="border-border"]')).toBeNull();
  });
});

/**
 * s78 — the two facts the grid was missing. Both answer "will anything post
 * from here", which is the highest-stakes question this surface takes.
 */
describe("the arming rung and the capability caveat, on the card", () => {
  it("a connected-but-unarmed seat says Not armed and names why, in words", async () => {
    wire([
      card({
        destination: "linkedin",
        label: "LinkedIn",
        state: "connected",
        connectedAs: "@steven",
        armed: false,
        armedReason: 'not armed — the active profile\'s social block has no "linkedin" entry',
      }),
    ]);
    render(<Integrations />);

    const li = await screen.findByText("LinkedIn", { selector: ".int-name" });
    const cardEl = li.closest(".int-card") as HTMLElement;
    expect(within(cardEl).getByText("Connected")).toBeInTheDocument();
    expect(within(cardEl).getByText("Not armed")).toBeInTheDocument();
    expect(within(cardEl).getByText(/social block has no "linkedin" entry/)).toBeInTheDocument();
  });

  it("Instagram states before the paste that nothing posts from it, and never claims 'Posting as'", async () => {
    wire([
      card({
        destination: "instagram",
        label: "Instagram",
        driver: "instagram-text-refusal",
        state: "connected",
        connectedAs: "@thalon",
        armed: true,
        armedReason: "armed by the active profile's social block",
      }),
    ]);
    render(<Integrations />);

    const ig = await screen.findByText("Instagram", { selector: ".int-name" });
    const cardEl = ig.closest(".int-card") as HTMLElement;
    expect(within(cardEl).getByText(/needs image or video media/)).toBeInTheDocument();
    // Even ARMED, the driver cannot post — so the card must not say it does.
    expect(cardEl.textContent).toContain("Connected as @thalon");
    expect(cardEl.textContent).not.toContain("Posting as");
  });
});
