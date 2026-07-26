// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { ProfileWire, ProfilesPayload } from "@/lib/profiles/types";
import { server } from "@/lib/testing/server";
import { ProfilesSurface } from "../profiles-surface";

const AT = "2026-07-20T00:00:00.000Z";

/**
 * An active profile carrying every block the wizard does NOT edit. Dropping
 * any of them on save disarmed a shipped capability twice on staging — this
 * fixture is what the carry test protects.
 */
function activeProfile(overrides: Partial<ProfileWire["config"]> = {}): ProfileWire {
  return {
    id: "profile-4",
    version: 4,
    active: true,
    config: {
      voice: { tone: ["Confident", "Concrete"], sample: "It has a build step." },
      denylist: ["guarantee"],
      platformProfiles: { linkedin: { tone: "professional", charLimit: 3000 } },
      identity: {
        company: "Demo Studio",
        oneLiner: "Content that ships itself",
        offers: [],
        facts: [],
        topics: ["deterministic video"],
        links: {},
      },
      icp: { roles: ["ops lead"], verticals: [], regions: [], dealbreakers: [], weights: {} },
      cadence: { linkedin: { maxPerDay: 1, minGapMinutes: 240 } },
      routing: { launch: ["linkedin"] },
      outreach: { steps: [{ afterDays: 0, channel: "email" }] },
      social: { platforms: { linkedin: { maxPerDay: 2 } } },
      ...overrides,
    } as ProfileWire["config"],
    createdAt: AT,
  };
}

/** Seeds the profile read and captures every save the surface posts. */
function seedProfile(profile: ProfileWire | null): { saves: Array<ProfileWire["config"]> } {
  const saves: Array<ProfileWire["config"]> = [];
  let current = profile;
  server.use(
    http.get("/api/profiles", () =>
      HttpResponse.json({
        active: current,
        history: current
          ? [
              {
                profileId: current.id,
                version: current.version,
                activatedOnCreate: true,
                at: AT,
              },
            ]
          : [],
        tenant: { slug: "self", name: "Demo Studio" },
      } satisfies ProfilesPayload),
    ),
    http.post("/api/profiles", async ({ request }) => {
      const body = (await request.json()) as { config: ProfileWire["config"] };
      saves.push(body.config);
      current = {
        id: `profile-${(current?.version ?? 0) + 1}`,
        version: (current?.version ?? 0) + 1,
        active: true,
        config: body.config,
        createdAt: AT,
      };
      return HttpResponse.json({ profile: current }, { status: 201 });
    }),
  );
  return { saves };
}

async function goToReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByTestId("wizard-step-5"));
}

/**
 * STEP 2 of the two-step rebuild: the sheet's wizard over the live profile.
 * The headline pin is the CONFIG CARRY — a rebuild that loses it is a
 * regression, not a port (found live on staging 2026-07-14 and 2026-07-19).
 */
describe("Profiles (exact-mock rebuild — Profiles.dc.html)", () => {
  it("renders the sheet's bands over the live profile: version pill, rail, powers card", async () => {
    seedProfile(activeProfile());
    const { container } = render(<ProfilesSurface />);

    // v4 active → this edit writes v5, exactly as the sheet's pill reads.
    expect(await screen.findByRole("button", { name: "editing → v5" })).toHaveClass(
      "pill",
      "pill-idle",
    );
    expect(
      screen.getByText("runs pin the version they used — nothing rewrites history"),
    ).toBeInTheDocument();
    expect(container.querySelectorAll(".wiz-grid > .card")).toHaveLength(3);
    // The rail is honest about the profile in hand: a step whose config is
    // already filled reads ✓, the step you are on keeps its number.
    expect(Array.from(container.querySelectorAll(".step")).map((el) => el.textContent)).toEqual([
      "1Company",
      "✓Voice",
      "✓Topics & audience",
      "✓Platforms & cadence",
      "✓Guardrails",
      "6Review · save v5",
    ]);
    expect(container.querySelector(".step.on")?.textContent).toBe("1Company");
    expect(
      Array.from(container.querySelectorAll(".powers-row b")).map((el) => el.textContent),
    ).toEqual(["Intel", "Leads", "Create", "The judge", "Calendar"]);
  });

  it("the Voice step is the sheet's, over the profile's own voice shape", async () => {
    seedProfile(activeProfile());
    const user = userEvent.setup();
    const { container } = render(<ProfilesSurface />);

    await user.click(await screen.findByTestId("wizard-step-1"));
    expect(screen.getByText("How should Thalon sound?")).toBeInTheDocument();

    // Stored tone reads back as the sheet's chips; the sample is the paragraph.
    const on = Array.from(container.querySelectorAll(".tone-chip.on")).map((el) => el.textContent);
    expect(on).toEqual(["Confident", "Concrete"]);
    expect(screen.getByLabelText(/Voice sample/)).toHaveValue("It has a build step.");
    expect(
      screen.getByText("The engine drafts in this register — it never copies the sample."),
    ).toBeInTheDocument();

    // The URL field is drawn but honestly unwired — never a hollow promise.
    expect(screen.getByLabelText("Or point at writing you admire")).toBeDisabled();
    expect(screen.getByText(/Not wired yet: nothing fetches a link/)).toBeInTheDocument();
  });

  it("tone caps at three, exactly as the sheet's label says", async () => {
    seedProfile(activeProfile());
    const user = userEvent.setup();
    render(<ProfilesSurface />);

    await user.click(await screen.findByTestId("wizard-step-1"));
    await user.click(screen.getByRole("button", { name: "Technical" }));
    expect(screen.getByRole("button", { name: "Technical" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Warm" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Confident" }));
    expect(screen.getByRole("button", { name: "Warm" })).toBeEnabled();
  });

  it("THE CARRY: saving writes the form-backed blocks and every carried block verbatim", async () => {
    const profile = activeProfile();
    const { saves } = seedProfile(profile);
    const user = userEvent.setup();
    render(<ProfilesSurface />);

    await goToReview(user);
    // The carry is visible provenance, not an invisible promise.
    const review = screen.getByText("Carried through this save, untouched").closest(".field");
    for (const block of ["ICP", "Cadence", "Routing", "Outreach", "Social"]) {
      expect(within(review as HTMLElement).getByText(block)).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "Save v5" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved as active version v5");
    expect(saves).toHaveLength(1);
    expect(saves[0].icp).toEqual(profile.config.icp);
    expect(saves[0].cadence).toEqual(profile.config.cadence);
    expect(saves[0].routing).toEqual(profile.config.routing);
    expect(saves[0].outreach).toEqual(profile.config.outreach);
    expect(saves[0].social).toEqual(profile.config.social);
    // …and the form-backed blocks still ride with them.
    expect(saves[0].denylist).toEqual(["guarantee"]);
    expect(saves[0].identity.company).toBe("Demo Studio");
    expect(saves[0].platformProfiles).toEqual({
      linkedin: { tone: "professional", charLimit: 3000 },
    });
  });

  it("a profile with no carried blocks invents none — absence stays absence", async () => {
    const bare = activeProfile();
    delete bare.config.icp;
    delete bare.config.cadence;
    delete bare.config.routing;
    delete bare.config.outreach;
    delete bare.config.social;
    const { saves } = seedProfile(bare);
    const user = userEvent.setup();
    render(<ProfilesSurface />);

    await goToReview(user);
    expect(screen.getByText(/Nothing else is set on this profile yet/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save v5" }));

    await screen.findByRole("status");
    expect(Object.keys(saves[0])).toEqual(
      expect.not.arrayContaining(["icp", "cadence", "routing", "outreach", "social"]),
    );
  });

  it("an untouched free-text tone is carried, not silently rewritten into chips", async () => {
    const profile = activeProfile({
      voice: { tone: "direct, technical, no hype", sample: "" },
    } as Partial<ProfileWire["config"]>);
    const { saves } = seedProfile(profile);
    const user = userEvent.setup();
    render(<ProfilesSurface />);

    await user.click(await screen.findByTestId("wizard-step-1"));
    expect(screen.getByText(/Your saved tone reads “direct, technical, no hype”/)).toBeInTheDocument();

    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "Save v5" }));

    await screen.findByRole("status");
    expect(saves[0].voice.tone).toBe("direct, technical, no hype");
  });

  /**
   * s78 — the review row must state what the SAVE will write. It used to
   * derive its own answer from the STORED tone, so it lied in both
   * directions: it printed a free-text register the save was about to
   * delete, and it printed derived chips the save was about to discard.
   */
  it("clearing every chip says the tone is going, and the save agrees", async () => {
    const profile = activeProfile({
      voice: { tone: "direct, technical, no hype", sample: "" },
    } as Partial<ProfileWire["config"]>);
    const { saves } = seedProfile(profile);
    const user = userEvent.setup();
    render(<ProfilesSurface />);

    // The free text lights "No hype" and "Technical" by substring match.
    await user.click(await screen.findByTestId("wizard-step-1"));
    await user.click(screen.getByRole("button", { name: "No hype" }));
    await user.click(screen.getByRole("button", { name: "Technical" }));

    await goToReview(user);
    expect(screen.getByText(/tone cleared — this save removes it/)).toBeInTheDocument();
    expect(screen.queryByText(/direct, technical, no hype/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save v5" }));
    await screen.findByRole("status");
    expect("tone" in saves[0].voice).toBe(false);
  });

  it("an UNTOUCHED free-text tone reviews as the free text the save will keep, not as derived chips", async () => {
    const profile = activeProfile({
      voice: { tone: "direct, technical, no hype", sample: "" },
    } as Partial<ProfileWire["config"]>);
    const { saves } = seedProfile(profile);
    const user = userEvent.setup();
    render(<ProfilesSurface />);

    await goToReview(user);
    expect(screen.getByText(/direct, technical, no hype/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save v5" }));
    await screen.findByRole("status");
    expect(saves[0].voice.tone).toBe("direct, technical, no hype");
  });

  it("picking chips writes them as the tone and keeps every other voice key", async () => {
    const profile = activeProfile({
      voice: { tone: ["Confident"], sample: "It has a build step.", persona: "the builder" },
    } as Partial<ProfileWire["config"]>);
    const { saves } = seedProfile(profile);
    const user = userEvent.setup();
    render(<ProfilesSurface />);

    await user.click(await screen.findByTestId("wizard-step-1"));
    await user.click(screen.getByRole("button", { name: "Technical" }));
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "Save v5" }));

    await screen.findByRole("status");
    expect(saves[0].voice).toEqual({
      tone: ["Confident", "Technical"],
      sample: "It has a build step.",
      persona: "the builder",
    });
  });

  it("the carried cadence is shown read-only, with the judge's role stated", async () => {
    seedProfile(activeProfile());
    const user = userEvent.setup();
    render(<ProfilesSurface />);

    await user.click(await screen.findByTestId("wizard-step-3"));
    expect(screen.getByText(/max 1\/day · min gap 240m/)).toBeInTheDocument();
    expect(screen.getByText(/carries your rules through every save untouched/)).toBeInTheDocument();
  });

  it("malformed platform JSON fails loud and posts nothing", async () => {
    const { saves } = seedProfile(activeProfile());
    const user = userEvent.setup();
    render(<ProfilesSurface />);

    await user.click(await screen.findByTestId("wizard-step-3"));
    await user.type(screen.getByLabelText(/Platform profiles/), "{{nope");
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "Save v5" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Platform profiles/);
    expect(saves).toHaveLength(0);
  });

  it("version history rides behind the header pill — the sheet's resting chrome is the pill", async () => {
    seedProfile(activeProfile());
    const user = userEvent.setup();
    render(<ProfilesSurface />);

    expect(screen.queryByTestId("version-history")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "editing → v5" }));

    const history = within(screen.getByTestId("version-history"));
    expect(history.getByText("v4")).toBeInTheDocument();
    expect(history.getByText("active")).toBeInTheDocument();
  });

  it("first run: no profile yet, so the primary creates v1", async () => {
    const { saves } = seedProfile(null);
    const user = userEvent.setup();
    render(<ProfilesSurface />);

    expect(await screen.findByRole("button", { name: "editing → v1" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Company"), "Thalon");
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "Create profile" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved as active version v1");
    expect(saves[0].identity.company).toBe("Thalon");
  });

  it("a failed profile read says so — never an empty-looking profile", async () => {
    server.use(http.get("/api/profiles", () => HttpResponse.error()));
    render(<ProfilesSurface />);

    expect(
      await screen.findByText(/read failure, not an empty profile/),
    ).toBeInTheDocument();
  });

  it("carries no legacy bridge styling — the rebuilt surface speaks the sheet's classes", async () => {
    seedProfile(activeProfile());
    const { container } = render(<ProfilesSurface />);

    await screen.findByRole("button", { name: "editing → v5" });
    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-card"]')).toBeNull();
    expect(container.firstElementChild).toHaveClass("content", "profiles-surface");
  });
});
