// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CreateSurface } from "@/components/create/create-surface";

/**
 * STEP 1 of the two-step rebuild: this pins the PURE PORT of
 * docs/research/mock-sheets/Create.dc.html — the sheet's bands, in the
 * sheet's own classes, with the sheet's placeholder content. It is
 * deliberately structural: there is no data wiring to assert yet.
 *
 * Step 2 restores the behaviour coverage the old-design suite carried
 * (recoverable from git history at the commit before this one): the family
 * pre-pick from an intel/lead capture, the →Email compose door and its
 * blocked-verdict honesty, the one-prompt video door and its staged-brief
 * exit, the post/page seam statement, and the capture-id loader's
 * stale-id degrade.
 */
describe("Create (exact-mock rebuild step 1 — pure port of Create.dc.html)", () => {
  const props = { initialPrompt: "", initialKeyword: "" };

  it("renders the sheet's bands: header, prompt hero, and the two-card run grid", () => {
    const { container } = render(<CreateSurface {...props} />);

    // Header band — headline + the advanced door.
    expect(screen.getByRole("heading", { name: "Create" })).toBeInTheDocument();
    expect(screen.getByText("Advanced · staged flow →")).toBeInTheDocument();

    // Prompt hero — the family segmented control (Video on), the flow label,
    // the prompt box with its placeholder tail, the pick chip, both buttons.
    expect(container.querySelector(".prompt-hero")).not.toBeNull();
    // Scoped to the control: "Video" is also a settings-row term below.
    const seg = container.querySelector(".seg");
    expect(Array.from(seg?.children ?? []).map((el) => el.textContent)).toEqual([
      "Post",
      "Video",
      "Page",
      "Email",
    ]);
    expect(seg?.querySelector(".seg-opt.on")?.textContent).toBe("Video");
    expect(screen.getByText("one prompt → drafts → the judge → your click")).toBeInTheDocument();
    expect(container.querySelector(".prompt-box")).not.toBeNull();
    expect(screen.getByText(/say it in your words; the profile carries the voice/)).toHaveClass("ph");
    expect(container.querySelector(".pick-chip")).not.toBeNull();
    expect(screen.getByText("Preview plan")).toBeInTheDocument();
    expect(screen.getByText("Generate")).toBeInTheDocument();

    // The grid: the run-settings card's six rows, in the sheet's order.
    expect(screen.getByText("This run, before it starts")).toBeInTheDocument();
    const terms = Array.from(container.querySelectorAll(".dl-row dt")).map((el) => el.textContent);
    expect(terms).toEqual([
      "Platforms",
      "Voice",
      "Grounding",
      "Discoverability",
      "Judge",
      "Video",
    ]);

    // The discoverability band marks its primary entity — the founder's
    // visible-provenance doctrine, structurally present from step 1.
    expect(container.querySelector(".term-chip.primary")).not.toBeNull();
    expect(screen.getByText(/it gates — it never rewrites/)).toBeInTheDocument();

    // Latest runs card + its door.
    expect(screen.getByText("Latest runs")).toBeInTheDocument();
    expect(screen.getByText("All runs →")).toBeInTheDocument();
    expect(container.querySelectorAll(".cr-grid > .card")).toHaveLength(2);
  });

  it("carries no legacy bridge styling — the port is the sheet's classes only", () => {
    const { container } = render(<CreateSurface {...props} />);
    // The old implementation was Tailwind semantic-token markup; a rebuilt
    // surface enters the burn-down at zero (the bridge pin enforces this
    // repo-wide, this keeps the failure local and legible).
    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-card"]')).toBeNull();
  });
});
