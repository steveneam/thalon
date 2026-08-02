// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { CreateContextLoader } from "@/components/create/create-context-loader";
import { CreateSurface } from "@/components/create/create-surface";
import type { CreateContext } from "@/lib/intel/types";
import { server } from "@/lib/testing/server";

const CONTEXT: CreateContext = {
  captureId: "intel-capture-1",
  kind: "trend_promote",
  family: "video",
  title: "Video as a build step: rendering launch clips from HTML",
  angle: "Show your own render pipeline end to end — prompt to playable file",
  hook: "Our launch video has no editor file. It has a build step.",
  sourceUrl: "https://example.com/demo/3kx3",
  areaName: "Short-form video tooling",
  score: 0.9,
  text: "Rendered our whole launch video from HTML.",
};

const BASE = { initialPrompt: "", initialKeyword: "" };

/** The discoverability terms actually riding into generation. */
function termChips(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".term-chip")).map((el) => el.textContent ?? "");
}

/** The s90a plan card lives BEHIND the run-line — open it for the dl-row pins. */
async function openPlan(container: HTMLElement, user: ReturnType<typeof userEvent.setup>) {
  await user.click(container.querySelector(".run-line") as HTMLElement);
  await waitFor(() => expect(container.querySelector(".plan-pop")).not.toBeNull());
}

/**
 * The s90b ask-card rebuild (Create.dc.html, s93 build): the sheet's bands
 * pinned structurally, with the honesty rules carried over intact — a
 * fabricated default, a real-looking zero, or a dead primary button is a
 * failure whatever the layout.
 */
describe("Create (exact-mock rebuild — the s90b ask-card sheet)", () => {
  it("renders the sheet's bands: headline question, ask-card, run-line, sugg-row, recent-line", async () => {
    const { container } = render(<CreateSurface {...BASE} />);

    expect(screen.getByText("What are we making today?")).toBeInTheDocument();
    expect(container.querySelector(".ask-card")).not.toBeNull();
    // The pre-s90b bands are GONE — demolished, not renovated.
    expect(container.querySelector(".prompt-hero")).toBeNull();
    expect(container.querySelector(".cr-grid")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Create" })).not.toBeInTheDocument();

    const seg = container.querySelector(".ask-row .seg");
    expect(Array.from(seg?.children ?? []).map((el) => el.textContent)).toEqual([
      "Post",
      "Video",
      "Page",
      "Email",
    ]);
    expect(seg?.querySelector(".seg-opt.on")?.textContent).toBe("Video");
    expect(screen.getByLabelText("The prompt")).toHaveClass("ask-box");

    // The controls live INSIDE the card's own bottom row (the 8-product take).
    const row = container.querySelector(".ask-row");
    expect(within(row as HTMLElement).getByRole("link", { name: "Start guided" })).toBeInTheDocument();
    expect(within(row as HTMLElement).getByRole("button", { name: "Generate" })).toBeInTheDocument();

    // The plan is ONE collapsed line at rest — the card is a state behind it.
    expect(container.querySelector(".run-line")).not.toBeNull();
    expect(container.querySelector(".plan-pop")).toBeNull();
    expect(screen.getByText("every gate on")).toBeInTheDocument();

    // The foot line is the real feed's newest run with its Composer door.
    await waitFor(() =>
      expect(container.querySelector(".recent-line")?.textContent).toContain("Latest ·"),
    );
    expect(screen.getByRole("link", { name: "All runs →" })).toHaveAttribute("href", "/app/runs");

    // No legacy bridge styling survives the rebuild.
    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-card"]')).toBeNull();
  });

  it("the run-line states real facts and opens the s90a plan card reversibly", async () => {
    server.use(
      http.get("/api/profiles", () =>
        HttpResponse.json({
          active: {
            version: 5,
            config: {
              platformProfiles: { linkedin: {}, x: {} },
              voice: { tone: "dry, technical" },
              denylist: [],
              identity: { topics: [] },
            },
          },
          history: [],
          tenant: { slug: "self", name: "Thalon" },
        }),
      ),
    );
    const user = userEvent.setup();
    const { container } = render(<CreateSurface {...BASE} />);

    const line = container.querySelector(".run-line") as HTMLElement;
    expect(line).toHaveAttribute("aria-expanded", "false");
    // The family fact is the true word for the run, not the fixture's "~40s".
    expect(line.textContent).toContain("staged video");

    await waitFor(() => expect(line.textContent).toContain("voice from profile v5"));
    expect(line.textContent).toContain("LinkedIn · X");

    await openPlan(container, user);
    expect(screen.getByText("This run, before it starts")).toBeInTheDocument();
    expect(Array.from(container.querySelectorAll(".dl-row dt")).map((el) => el.textContent)).toEqual(
      ["Platforms", "Voice", "Grounding", "Discoverability", "Judge", "Video"],
    );
    expect(screen.getByText(/it gates — it never rewrites/)).toBeInTheDocument();

    await user.click(container.querySelector(".run-line") as HTMLElement);
    expect(container.querySelector(".plan-pop")).toBeNull();
  });

  it("the Start guided door carries what was already said — family, prompt and capture", async () => {
    render(<CreateSurface {...BASE} context={CONTEXT} />);

    const guided = screen.getByRole("link", { name: "Start guided" });
    const href = guided.getAttribute("href") ?? "";
    expect(href).toContain("/app/create/guided?");
    expect(href).toContain("family=video");
    expect(href).toContain(`ctx=${CONTEXT.captureId}`);
    // URLSearchParams space encoding — the prompt genuinely rides along.
    expect(href).toContain("prompt=Open+on+the+hook");
  });

  it("a capture pre-picks its family, seeds the prompt, and the chip reads as the sheet draws it", () => {
    const { container } = render(<CreateSurface {...BASE} context={CONTEXT} />);

    expect(container.querySelector(".seg .seg-opt.on")?.textContent).toBe("Video");
    expect(screen.getByLabelText("The prompt")).toHaveValue(
      "Open on the hook: “Our launch video has no editor file. It has a build step.” Angle: Show your own render pipeline end to end — prompt to playable file.",
    );

    const chip = container.querySelector(".pick-chip");
    expect(chip?.textContent).toContain("From intel");
    expect(chip?.querySelector(".pill-heat-hot")?.textContent).toBe("Hot");
    // What rode in lives on the disclosure's title — the chip stays minimal.
    expect(within(chip as HTMLElement).getByRole("button", { name: /From intel/ })).toHaveAttribute(
      "title",
      expect.stringContaining("title + angle + hook + source + area + source text attached"),
    );
  });

  it("dropping the pick is honest: the context leaves the run it grounds", async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateSurface {...BASE} context={CONTEXT} />);

    await user.click(screen.getByRole("button", { name: /Drop this context/ }));

    expect(container.querySelector(".pick-chip")).toBeNull();
    await openPlan(container, user);
    expect(screen.getByText("Your prompt only")).toBeInTheDocument();
    expect(screen.queryByText("Short-form video tooling")).not.toBeInTheDocument();
  });

  it("the chip opens per-field pruning, and dropping ONE field removes only that field from generation", async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateSurface {...BASE} context={CONTEXT} />);

    // At rest there is no second band — the panel lives behind the chip itself.
    expect(container.querySelector(".pick-panel")).toBeNull();
    const disclosure = screen.getByRole("button", { name: /From intel/ });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");

    await user.click(disclosure);
    const panel = container.querySelector(".pick-panel");
    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).getByText("area")).toBeInTheDocument();

    // Drop the area alone — it leaves GENERATION (the plan card's term chips).
    await user.click(screen.getByRole("button", { name: /^Drop area —/ }));
    await openPlan(container, user);
    expect(termChips(container)).not.toContain("Short-form video tooling");
    // The chip itself never disappears: pruning is reversible.
    expect(container.querySelector(".pick-chip")).not.toBeNull();

    // And it comes back.
    await user.click(screen.getByRole("button", { name: /Put area back/ }));
    expect(termChips(container)).toContain("Short-form video tooling");
  });

  it("pruning every field is the same as no context — honestly stated, still restorable", async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateSurface {...BASE} context={CONTEXT} />);

    await user.click(screen.getByRole("button", { name: /From intel/ }));
    for (const label of ["title", "angle", "hook", "source", "area", "source text"]) {
      await user.click(screen.getByRole("button", { name: new RegExp(`^Drop ${label} —`) }));
    }

    expect(screen.getByRole("button", { name: /From intel/ }).textContent).toContain(
      "nothing attached — your prompt alone",
    );
    // The chip and its panel survive, so the operator can undo.
    expect(container.querySelector(".pick-panel")).not.toBeNull();
  });

  it("discoverability shows the inputs that exist and marks nothing primary before generation", async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateSurface {...BASE} context={CONTEXT} />);

    await openPlan(container, user);
    expect(await screen.findByText("Short-form video tooling")).toHaveClass("term-chip");
    expect(container.querySelector(".term-chip.primary")).toBeNull();
    expect(
      screen.getByText(/the subject entity is declared at generation and leads the list/),
    ).toBeInTheDocument();
  });

  it("the one-prompt video door is real: the brief rides in and the outcome names the project", async () => {
    let sent: unknown;
    server.use(
      http.post("/api/create/video", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({
          status: "queued",
          draftId: "d-video-1",
          stageKeys: ["structure", "scenes_effects", "polish"],
          projectId: "vp-1",
          projectName: "Video: launch clips",
          cutId: "cut-1",
          takeCount: 3,
        });
      }),
    );
    const user = userEvent.setup();
    render(<CreateSurface {...BASE} context={CONTEXT} />);

    await user.click(screen.getByRole("button", { name: "Generate" }));

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(sent).toMatchObject({
      prompt: `Open on the hook: “${CONTEXT.hook}” Angle: ${CONTEXT.angle}.`,
      sourceUrl: CONTEXT.sourceUrl,
    });

    expect(await screen.findByRole("status")).toHaveTextContent(/Direction doc generated and judged/);
    expect(screen.getByRole("link", { name: "Review it in Approve →" })).toHaveAttribute(
      "href",
      "/app/approve",
    );
  });

  it("post states the open seam honestly — never a dead primary button", async () => {
    const user = userEvent.setup();
    render(<CreateSurface {...BASE} />);

    await user.click(screen.getByRole("button", { name: "Post" }));

    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    // The refusal comes from the shared seam (lib/create/families), so this
    // sentence and the one Intel's exits show can never drift apart.
    expect(screen.getByText(/Live post generation isn’t wired to Create yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toHaveAttribute(
      "title",
      expect.stringContaining("Live post generation isn’t wired to Create yet"),
    );
  });

  it("the Email family without a lead context points at the lead-card exit", async () => {
    const user = userEvent.setup();
    render(<CreateSurface {...BASE} />);

    await user.click(screen.getByRole("button", { name: "Email" }));

    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(screen.getByText(/use the → Email exit on a lead card/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing here is ever sent automatically/)).toBeInTheDocument();
  });

  /**
   * Suggestion chips are REAL Intel picks through the ?ctx= spine — never
   * fixture chips, and an empty pick list says so quietly.
   */
  describe("the sugg-row is real Intel picks", () => {
    it("renders picks as prefill doors through the existing ?ctx= spine", async () => {
      server.use(
        http.get("/api/intel/picks", () =>
          HttpResponse.json({
            picks: [
              {
                captureId: "cap-1",
                at: "2026-08-01T10:00:00.000Z",
                title: "Video as a build step",
                family: "post",
                score: 0.9,
                source: "intel",
                thumbnailUrl: null,
              },
            ],
          }),
        ),
      );
      const { container } = render(<CreateSurface {...BASE} />);

      await waitFor(() => expect(container.querySelector(".sugg")).not.toBeNull());
      const sugg = container.querySelector(".sugg") as HTMLAnchorElement;
      expect(sugg.getAttribute("href")).toBe("/app/create?ctx=cap-1");
      expect(sugg.querySelector(".k")?.textContent).toBe("post");
      expect(sugg.textContent).toContain("Video as a build step");
      expect(sugg.querySelector(".pill-heat-hot")).not.toBeNull();
    });

    it("an empty pick list says so with the Intel door — never invented chips", async () => {
      const { container } = render(<CreateSurface {...BASE} />);
      await waitFor(() =>
        expect(container.querySelector(".sugg-row")?.textContent).toContain("no Intel picks yet"),
      );
      expect(screen.getByRole("link", { name: "open Intel →" })).toHaveAttribute(
        "href",
        "/app/intel",
      );
    });

    it("a failed picks read is a read failure, never an empty list", async () => {
      server.use(http.get("/api/intel/picks", () => HttpResponse.error()));
      const { container } = render(<CreateSurface {...BASE} />);
      await waitFor(() =>
        expect(container.querySelector(".sugg-row")?.textContent).toContain(
          "couldn’t read Intel picks",
        ),
      );
    });
  });

  /**
   * s77/s79 C3 — measured live with /api/profiles cut: the surface painted
   * FIVE positive claims about a profile it had never read. A broken read
   * and an empty one are different facts. The claims now live in two homes —
   * the run-line at rest, the plan card behind it — and both must stay honest.
   */
  describe("a failed profile read is UNREAD, never empty", () => {
    async function renderWithDeadProfiles() {
      server.use(http.get("/api/profiles", () => HttpResponse.error()));
      const user = userEvent.setup();
      const view = render(<CreateSurface {...BASE} />);
      await waitFor(() =>
        expect(view.container.querySelector(".run-line")?.textContent).toContain(
          "platforms unread",
        ),
      );
      await openPlan(view.container, user);
      expect(
        await screen.findByText(/Couldn’t read your profile — a read failure, not an empty one/),
      ).toBeInTheDocument();
      return { ...view, user };
    }

    it("never claims there is no active profile", async () => {
      await renderWithDeadProfiles();
      expect(
        screen.queryByText(/no active profile — these are the engine’s own defaults/),
      ).not.toBeInTheDocument();
    });

    it("never reports an empty denylist it could not read — the sharpest of the five", async () => {
      const { container } = await renderWithDeadProfiles();
      const judge = Array.from(container.querySelectorAll(".dl-row")).find(
        (row) => row.querySelector("dt")?.textContent === "Judge",
      );
      expect(judge?.textContent).toContain("Denylist unread");
      expect(judge?.textContent).not.toContain("Denylist · empty");
    });

    it("says unread on every row that would otherwise assert an absence", async () => {
      const { container } = await renderWithDeadProfiles();
      const row = (dt: string) =>
        Array.from(container.querySelectorAll(".dl-row")).find(
          (r) => r.querySelector("dt")?.textContent === dt,
        )?.textContent ?? "";
      expect(row("Platforms")).toContain("unread");
      expect(row("Platforms")).not.toContain("none in your profile yet");
      expect(row("Voice")).toContain("unread");
      expect(row("Voice")).not.toContain("not set");
      expect(row("Discoverability")).toContain("unread");
      expect(row("Discoverability")).not.toContain("no terms yet");
    });

    it("offers a retry — an honest failure is not a terminal one", async () => {
      const { user } = await renderWithDeadProfiles();
      server.resetHandlers();
      await user.click(screen.getByRole("button", { name: "Try again" }));
      await waitFor(() =>
        expect(screen.queryByText(/Couldn’t read your profile/)).not.toBeInTheDocument(),
      );
      expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    });

    it("still says 'no active profile' when the read SUCCEEDS and there genuinely is none", async () => {
      server.use(http.get("/api/profiles", () => HttpResponse.json({ active: null, profiles: [] })));
      const user = userEvent.setup();
      const { container } = render(<CreateSurface {...BASE} />);
      await waitFor(() =>
        expect(container.querySelector(".run-line")?.textContent).toContain(
          "no platforms in your profile yet",
        ),
      );
      await openPlan(container, user);
      expect(
        await screen.findByText(/no active profile — these are the engine’s own defaults/),
      ).toBeInTheDocument();
    });
  });

  /**
   * s77/s79 C4 — every fact is a door, and the capture's source is the fact
   * the judge grounds against. The row lives in the plan card now; the door
   * survives the move.
   */
  describe("the Grounding row's source door", () => {
    function groundingRow(container: HTMLElement): Element | undefined {
      return Array.from(container.querySelectorAll(".dl-row")).find(
        (row) => row.querySelector("dt")?.textContent === "Grounding",
      );
    }

    it("links the capture's own source, opening out of the workspace safely", async () => {
      const user = userEvent.setup();
      const { container } = render(<CreateSurface {...BASE} context={CONTEXT} />);
      await openPlan(container, user);
      const link = groundingRow(container)?.querySelector("a");
      expect(link).toHaveAttribute("href", CONTEXT.sourceUrl);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link?.getAttribute("rel")).toContain("noreferrer");
    });

    it("draws no door when there is no source to open", async () => {
      const user = userEvent.setup();
      const { container } = render(<CreateSurface {...BASE} />);
      await openPlan(container, user);
      expect(groundingRow(container)?.querySelector("a")).toBeNull();
    });

    it("drops the door with the field — a pruned source is not grounding the run", async () => {
      const user = userEvent.setup();
      const { container } = render(<CreateSurface {...BASE} context={CONTEXT} />);
      await user.click(container.querySelector(".pick-open") as HTMLElement);
      await user.click(screen.getByRole("button", { name: /^Drop source —/ }));
      await openPlan(container, user);
      expect(groundingRow(container)?.querySelector("a")).toBeNull();
    });
  });

  describe("the recent-line is the real feed", () => {
    it("carries the newest run with its Composer door", async () => {
      const { container } = render(<CreateSurface {...BASE} />);
      await waitFor(() =>
        expect(container.querySelector(".recent-line")?.textContent).toContain("Latest ·"),
      );
      const composer = screen.getByRole("link", { name: "In Composer →" });
      expect(composer.getAttribute("href")).toMatch(/^\/app\/create\/run\//);
    });

    it("a failed run-feed read says so — a read failure, never an empty history", async () => {
      server.use(http.get("/api/runs", () => HttpResponse.error()));
      render(<CreateSurface {...BASE} />);
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/read failure, not an empty history/);
      // The Runs door survives the failure — the operator can go look.
      expect(screen.getByRole("link", { name: "All runs →" })).toHaveAttribute("href", "/app/runs");
    });

    it("no runs yet is stated, never dressed as history", async () => {
      server.use(http.get("/api/runs", () => HttpResponse.json({ runs: [] })));
      const { container } = render(<CreateSurface {...BASE} />);
      await waitFor(() =>
        expect(container.querySelector(".recent-line")?.textContent).toContain("No runs yet"),
      );
      expect(screen.queryByRole("link", { name: "In Composer →" })).not.toBeInTheDocument();
    });
  });
});

describe("CreateContextLoader — the capture-id door", () => {
  it("a stale capture id degrades to a plain Create, never an error page", async () => {
    render(<CreateContextLoader contextId="intel-capture-nope" {...BASE} />);

    // The pre-resolve state wears the same chrome, so the surface itself is
    // the thing to wait for: the prompt is what proves Create actually loaded.
    expect(await screen.findByLabelText("The prompt")).toBeInTheDocument();
    expect(screen.getByLabelText("The prompt")).toHaveValue("");
  });
});
