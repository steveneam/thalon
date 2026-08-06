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
    armState: null,
    postingConfigured: null,
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

function wire(
  cards: WireIntegrationCard[] = CARDS,
  postingScope: "selective" | "all" = "selective",
  // The master key. Defaults to FALSE because that is the deployment's real
  // state — the queue has never been armed — so every existing expectation in
  // this file is asserted against the honest surface.
  queueArmed = false,
): void {
  server.use(
    http.get("/api/integrations", () => HttpResponse.json({ cards, postingScope, queueArmed })),
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

/**
 * Control-arc parts A + A2 (s103): the arm control and the posting scope.
 *
 * The overlay case earned its own ratchet by SHIPPING WRONG for one render:
 * an unconfigured destination read "this destination posts, even though its
 * own setting says off" while the engine's resolver leaves exactly that
 * destination `off`. Nothing in the suite could see it — the copy was valid,
 * the state was right, and the card was simply asserting something the engine
 * disagreed with. Caught by loading the page and reading it.
 */
describe("the queue's arm control and the posting scope", () => {
  const CONNECTED_SOCIAL: WireIntegrationCard[] = [
    card({
      destination: "bluesky",
      label: "Bluesky",
      driver: "bluesky-post",
      state: "connected",
      connectedAs: "@steve",
      armed: true,
      armState: "review",
      postingConfigured: true,
    }),
    card({
      destination: "linkedin",
      label: "LinkedIn",
      driver: "linkedin-rest-posts",
      state: "connected",
      connectedAs: "Steven",
      armed: true,
      armState: "off",
      postingConfigured: true,
    }),
    card({
      destination: "instagram",
      label: "Instagram",
      driver: "instagram-text-refusal",
      state: "connected",
      connectedAs: "@steve",
      armed: false,
      armState: "off",
      postingConfigured: false,
    }),
  ];

  /**
   * Phase 0 (s112). The three gates are AND — master key, then scope, then the
   * destination's own state — and the surface could only ever see the bottom
   * two. So it offered "Live: due posts go out on their own" on a deployment
   * whose tick cannot send anything, which is a control asserting what the
   * engine will not do.
   *
   * These pin the DISCLOSURE, not a door: nothing here arms the queue, and
   * there is deliberately no control that does.
   */
  it("discloses that unattended posting is off for the deployment, once, at the head control", async () => {
    wire(CONNECTED_SOCIAL, "selective", false);
    render(<Integrations />);
    expect(
      await screen.findByText(/Unattended posting is switched off for this deployment/i),
    ).toBeInTheDocument();
    // Said ONCE. Repeating it on every card would be noise, and the founder's
    // standing steer is fewer words.
    expect(
      screen.getAllByText(/Unattended posting is switched off for this deployment/i),
    ).toHaveLength(1);
  });

  it("drops the disclosure the moment the master key is armed", async () => {
    wire(CONNECTED_SOCIAL, "selective", true);
    render(<Integrations />);
    await screen.findByRole("group", { name: "What the queue may do with Bluesky" });
    expect(
      screen.queryByText(/Unattended posting is switched off for this deployment/i),
    ).not.toBeInTheDocument();
  });

  it("stops promising Live sends while the queue is unarmed, and promises it when armed", async () => {
    wire(CONNECTED_SOCIAL, "selective", false);
    const view = render(<Integrations />);
    const seg = await screen.findByRole("group", { name: "What the queue may do with Bluesky" });
    expect(within(seg).getByRole("button", { name: "Live" })).toHaveAttribute(
      "title",
      expect.stringContaining("once unattended posting is switched on"),
    );
    view.unmount();

    wire(CONNECTED_SOCIAL, "selective", true);
    render(<Integrations />);
    const armedSeg = await screen.findByRole("group", {
      name: "What the queue may do with Bluesky",
    });
    expect(within(armedSeg).getByRole("button", { name: "Live" })).toHaveAttribute(
      "title",
      "Due posts go out on their own.",
    );
  });

  it("says HELD on a destination that would send — and only on those", async () => {
    // Bluesky is `review` (waits for the operator either way, so no claim to
    // correct); LinkedIn is `live` and IS promising an unattended send.
    wire(
      [
        CONNECTED_SOCIAL[0],
        { ...CONNECTED_SOCIAL[1], armState: "live" },
        CONNECTED_SOCIAL[2],
      ],
      "selective",
      false,
    );
    render(<Integrations />);
    await screen.findByRole("group", { name: "What the queue may do with LinkedIn" });
    const held = screen.getAllByText(/Held: unattended posting is switched off/i);
    expect(held).toHaveLength(1);
    expect(destinationCard("LinkedIn")).toContainElement(held[0]);
  });

  it("splits connected from available and counts each — not one flat grid", async () => {
    wire();
    render(<Integrations />);
    expect(
      await screen.findByText("Connected", { selector: ".t-title" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Available", { selector: ".t-title" })).toBeInTheDocument();
  });

  it("shows each destination's STORED state as a three-way seg, review included", async () => {
    wire(CONNECTED_SOCIAL);
    render(<Integrations />);

    const bluesky = await screen.findByRole("group", {
      name: "What the queue may do with Bluesky",
    });
    expect(within(bluesky).getByRole("button", { name: "Review" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(bluesky).getByRole("button", { name: "Off" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("under `all`, a destination keeps showing its STORED state — never blanked or rewritten", async () => {
    // ARMED, deliberately: the `all` overlay says "this destination posts",
    // and that is only true once the master key is on. s112 made the master
    // key's line take precedence for exactly that reason, so testing the
    // scope overlay in isolation means arming the gate above it.
    wire(CONNECTED_SOCIAL, "all", true);
    render(<Integrations />);

    // LinkedIn is stored `off` and posts under `all`; the control still says
    // `off`, which is what makes the flip back legibly lossless.
    const linkedin = await screen.findByRole("group", {
      name: "What the queue may do with LinkedIn",
    });
    expect(within(linkedin).getByRole("button", { name: "Off" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(destinationCard("LinkedIn")).toHaveTextContent(/this destination posts, even though/);
  });

  /**
   * The precedence itself, pinned: while the master key is off, "this
   * destination posts" is FALSE, so the scope overlay must not be the sentence
   * the operator reads. This is the exact claim the phase-0 fix exists to stop.
   */
  it("under `all` and UNARMED, the master key supersedes the scope's posting claim", async () => {
    wire(CONNECTED_SOCIAL, "all", false);
    render(<Integrations />);
    await screen.findByRole("group", { name: "What the queue may do with LinkedIn" });
    const linkedin = destinationCard("LinkedIn");
    expect(linkedin).not.toHaveTextContent(/this destination posts, even though/);
    expect(linkedin).toHaveTextContent(/Held: unattended posting is switched off/i);
  });

  it("under `all`, a REVIEW says it is still held — the one place `all` does not mean all", async () => {
    wire(CONNECTED_SOCIAL, "all");
    render(<Integrations />);
    await screen.findByText("Connected", { selector: ".t-title" });
    expect(destinationCard("Bluesky")).toHaveTextContent(
      /a review you asked for is never overridden/,
    );
    expect(destinationCard("Bluesky")).not.toHaveTextContent(/this destination posts/);
  });

  it("under `all`, an UNCONFIGURED destination never claims it posts — the card cannot contradict the engine", async () => {
    wire(CONNECTED_SOCIAL, "all");
    render(<Integrations />);
    await screen.findByText("Connected", { selector: ".t-title" });

    const instagram = destinationCard("Instagram");
    // The resolver leaves an entry-less destination `off` under `all`, because
    // a claimed row the publish door then refuses is marked failed — terminal.
    expect(instagram).toHaveTextContent(/only covers destinations set up for posting/);
    expect(instagram).not.toHaveTextContent(/this destination posts, even though/);
  });

  it("states the widening BEFORE the first flip: arming an unset destination also allows manual publishing", async () => {
    wire(CONNECTED_SOCIAL);
    render(<Integrations />);
    await screen.findByText("Connected", { selector: ".t-title" });
    expect(destinationCard("Instagram")).toHaveTextContent(
      /Not set up for posting yet — choosing Review or Live creates its posting settings/,
    );
  });

  it("sends ONE flip and re-reads — nothing renders as armed before the server stored it", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    wire(CONNECTED_SOCIAL);
    server.use(
      http.patch("/api/integrations/arming", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ social: {} });
      }),
    );
    render(<Integrations />);

    const bluesky = await screen.findByRole("group", {
      name: "What the queue may do with Bluesky",
    });
    await user.click(within(bluesky).getByRole("button", { name: "Live" }));

    expect(bodies).toEqual([{ platform: "bluesky", armState: "live" }]);
  });

  it("the scope control is absent when nothing connected can post — no gate over an empty set", async () => {
    wire([card({ destination: "website_hosted", class: "website", label: "Hosted blog" })]);
    render(<Integrations />);
    await screen.findByText("Connected", { selector: ".t-title" });
    expect(
      screen.queryByRole("group", { name: "Which connected destinations may post" }),
    ).not.toBeInTheDocument();
  });
});
