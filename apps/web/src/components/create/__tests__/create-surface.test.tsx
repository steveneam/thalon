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

/**
 * STEP 2 of the two-step rebuild: the sheet's bands (pinned structurally
 * below) now carry real reads. These pin the honesty rules — a fabricated
 * default, a real-looking zero, or a dead primary button is a failure.
 */
describe("Create (exact-mock rebuild — Create.dc.html)", () => {
  it("renders the sheet's bands: header, prompt hero, and the two-card run grid", async () => {
    const { container } = render(<CreateSurface {...BASE} />);

    expect(screen.getByRole("heading", { name: "Create" })).toBeInTheDocument();
    // The sheet's own link has href="#" — it never wired a staged AUTHORING
    // door, and there still isn't one, so the control names what it reaches.
    expect(screen.getByText("Staged runs in Approve →")).toBeInTheDocument();
    expect(screen.getByText("advanced staged authoring isn’t wired yet")).toBeInTheDocument();
    expect(container.querySelector(".prompt-hero")).not.toBeNull();

    const seg = container.querySelector(".seg");
    expect(Array.from(seg?.children ?? []).map((el) => el.textContent)).toEqual([
      "Post",
      "Video",
      "Page",
      "Email",
    ]);
    expect(seg?.querySelector(".seg-opt.on")?.textContent).toBe("Video");
    expect(screen.getByText("one prompt → drafts → the judge → your click")).toBeInTheDocument();
    expect(screen.getByLabelText("The prompt")).toHaveClass("prompt-box");

    // The run-settings card keeps the sheet's rows, in the sheet's order.
    expect(screen.getByText("This run, before it starts")).toBeInTheDocument();
    expect(Array.from(container.querySelectorAll(".dl-row dt")).map((el) => el.textContent)).toEqual(
      ["Platforms", "Voice", "Grounding", "Discoverability", "Judge", "Video"],
    );
    expect(screen.getByText(/it gates — it never rewrites/)).toBeInTheDocument();
    expect(screen.getByText("Latest runs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All runs →" })).toHaveAttribute("href", "/app/runs");
    expect(container.querySelectorAll(".cr-grid > .card")).toHaveLength(2);

    // No legacy bridge styling survives the rebuild.
    await screen.findByText(/prefilled from profile v|no active profile/);
    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-card"]')).toBeNull();
  });

  it("a capture pre-picks its family, seeds the prompt, and names what actually rode in", () => {
    const { container } = render(<CreateSurface {...BASE} context={CONTEXT} />);

    expect(container.querySelector(".seg .seg-opt.on")?.textContent).toBe("Video");
    expect(screen.getByLabelText("The prompt")).toHaveValue(
      "Open on the hook: “Our launch video has no editor file. It has a build step.” Angle: Show your own render pipeline end to end — prompt to playable file.",
    );

    // The pick chip states the truth about THIS capture, heat band included.
    const chip = container.querySelector(".pick-chip");
    expect(chip?.textContent).toContain("From intel");
    expect(chip?.textContent).toContain("title + angle + hook + source + area + source text attached");
    expect(chip?.querySelector(".pill-heat-hot")?.textContent).toBe("Hot");
  });

  it("dropping the pick is honest: the context leaves the run it grounds", async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateSurface {...BASE} context={CONTEXT} />);

    expect(await screen.findByText("Short-form video tooling")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Drop this context/ }));

    expect(container.querySelector(".pick-chip")).toBeNull();
    expect(screen.getByText("Your prompt only")).toBeInTheDocument();
    expect(screen.queryByText("Short-form video tooling")).not.toBeInTheDocument();
  });

  it("the chip opens per-field pruning, and dropping ONE field removes only that field from generation", async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateSurface {...BASE} context={CONTEXT} />);

    // The capture's area is a live generation input before we prune anything.
    expect(await screen.findByText("Short-form video tooling")).toBeInTheDocument();

    // At rest there is no second band — the panel lives behind the chip itself.
    expect(container.querySelector(".pick-panel")).toBeNull();
    const disclosure = screen.getByRole("button", { name: /From intel/ });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");

    await user.click(disclosure);
    const panel = container.querySelector(".pick-panel");
    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).getByText("area")).toBeInTheDocument();

    // Drop the area alone.
    await user.click(screen.getByRole("button", { name: /^Drop area —/ }));

    // It left GENERATION — the term chip is gone. (The value itself stays
    // visible in the panel, struck through, because dropping is reversible.)
    expect(termChips(container)).not.toContain("Short-form video tooling");
    expect(screen.getByRole("button", { name: /From intel/ }).textContent).toContain(
      "title + angle + hook + source + source text attached",
    );
    // The chip itself never disappears: pruning is reversible, dropping is not.
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
    expect(termChips(container)).not.toContain("Short-form video tooling");
    // The chip and its panel survive, so the operator can undo.
    expect(container.querySelector(".pick-panel")).not.toBeNull();
  });

  it("discoverability shows the inputs that exist and marks nothing primary before generation", async () => {
    const { container } = render(<CreateSurface {...BASE} context={CONTEXT} />);

    // The capture's area is a real input; the subject entity is engine-derived.
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

    // The brief = the seeded prompt; the surviving source rides in with it.
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
    // The refusal comes from the shared seam now (lib/create/families), so
    // this sentence and the one Intel's exits show can never drift apart.
    expect(
      screen.getByText(/Live post generation isn’t wired to Create yet/),
    ).toBeInTheDocument();
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
   * s77/s79 C3 — measured live with /api/profiles cut: the surface painted
   * FIVE positive claims about a profile it had never read ("no active
   * profile · these are the engine's own defaults", "none in your profile
   * yet", "not set", "no terms yet", and "Denylist · empty · grounding ·
   * every gate on") against a real profile carrying six denylist terms. A
   * broken read and an empty one are different facts.
   */
  describe("a failed profile read is UNREAD, never empty", () => {
    async function renderWithDeadProfiles() {
      server.use(http.get("/api/profiles", () => HttpResponse.error()));
      const view = render(<CreateSurface {...BASE} />);
      expect(
        await screen.findByText(/Couldn’t read your profile — a read failure, not an empty one/),
      ).toBeInTheDocument();
      return view;
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
      const user = userEvent.setup();
      await renderWithDeadProfiles();
      server.resetHandlers();
      await user.click(screen.getByRole("button", { name: "Try again" }));
      await waitFor(() =>
        expect(screen.queryByText(/Couldn’t read your profile/)).not.toBeInTheDocument(),
      );
      expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    });

    it("still says 'no active profile' when the read SUCCEEDS and there genuinely is none", async () => {
      server.use(http.get("/api/profiles", () => HttpResponse.json({ active: null, profiles: [] })));
      render(<CreateSurface {...BASE} />);
      expect(
        await screen.findByText(/no active profile — these are the engine’s own defaults/),
      ).toBeInTheDocument();
    });
  });

  /**
   * s77/s79 C4 — the sheet draws `view sources` on the Grounding row
   * (Create.dc.html:84) and the rebuild dropped it, leaving the capture's
   * source URL as plain text in the prune panel and a link nowhere on the
   * surface (measured live: zero anchors to it). Every fact is a door, and
   * this is the fact the judge grounds against.
   */
  describe("the Grounding row's source door", () => {
    function groundingRow(container: HTMLElement): Element | undefined {
      return Array.from(container.querySelectorAll(".dl-row")).find(
        (row) => row.querySelector("dt")?.textContent === "Grounding",
      );
    }

    it("links the capture's own source, opening out of the workspace safely", async () => {
      const { container } = render(<CreateSurface {...BASE} context={CONTEXT} />);
      const link = groundingRow(container)?.querySelector("a");
      expect(link).toHaveAttribute("href", CONTEXT.sourceUrl);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link?.getAttribute("rel")).toContain("noreferrer");
    });

    it("draws no door when there is no source to open", () => {
      const { container } = render(<CreateSurface {...BASE} />);
      expect(groundingRow(container)?.querySelector("a")).toBeNull();
    });

    it("drops the door with the field — a pruned source is not grounding the run", async () => {
      const user = userEvent.setup();
      const { container } = render(<CreateSurface {...BASE} context={CONTEXT} />);
      await user.click(container.querySelector(".pick-open") as HTMLElement);
      await user.click(screen.getByRole("button", { name: /^Drop source —/ }));
      expect(groundingRow(container)?.querySelector("a")).toBeNull();
    });
  });

  it("a failed run-feed read is an alert with retry, never an empty history", async () => {
    server.use(http.get("/api/runs", () => HttpResponse.error()));
    render(<CreateSurface {...BASE} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/read failure, not an empty history/);
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("unresolved profile reads show '–', never a fabricated default", async () => {
    server.use(http.get("/api/profiles", () => new Promise(() => {})));
    const { container } = render(<CreateSurface {...BASE} />);

    expect(await screen.findByText("reading your profile…")).toBeInTheDocument();
    expect(container.textContent).toContain("–");
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
