// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { WizardSurface } from "@/components/create/wizard-surface";
import type { CreateContext } from "@/lib/intel/types";
import { server } from "@/lib/testing/server";

const CONTEXT: CreateContext = {
  captureId: "intel-capture-1",
  kind: "trend_promote",
  family: "video",
  title: "Video as a build step: rendering launch clips from HTML",
  angle: "Show your own render pipeline end to end",
  hook: "Our launch video has no editor file. It has a build step.",
  sourceUrl: "https://example.com/demo/3kx3",
  score: 0.9,
};

const PLAN = {
  platforms: [
    {
      platform: "tiktok",
      admitted: false,
      refusal: {
        code: "channel_not_connected",
        message: "tiktok has no connector in this build — drop it from this run for now.",
      },
    },
    { platform: "instagram", admitted: true },
    { platform: "facebook", admitted: true },
  ],
  judgeGates: ["g1", "g3_screen", "g3_final"],
  targetTerms: ["render pipeline"],
  costPreview: { meteredCalls: 1, unestimated: [] },
  family: {},
};

function planHandler(capture?: (body: unknown) => void) {
  return http.post("/api/create/plan", async ({ request }) => {
    const body = await request.json();
    capture?.(body);
    return HttpResponse.json({ plan: PLAN });
  });
}

const BASE = { initialPrompt: "" };

/**
 * The wizard (Create Wizard.dc.html, s90b): accordion slots, capability on
 * the chips BEFORE spend (R3), honest PENDING plan region, the brief tucked.
 * Every verdict on it must be the derivation's own — these tests pin that a
 * fixture chip or an invented capability word cannot ship.
 */
describe("Create wizard (exact-mock build — the s90b amended sheet)", () => {
  it("renders the sheet's structure: four slots in order, the What slot open on an empty brief", async () => {
    server.use(planHandler());
    const { container } = render(<WizardSurface {...BASE} context={null} />);

    expect(screen.getByRole("heading", { name: "Create · guided" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the prompt →" })).toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll(".slot-title")).map((el) => el.textContent),
    ).toEqual(["What", "Platforms", "Sources & media", "Review plan"]);
    // No brief rode in — the first slot greets, with its num filled "now".
    expect(container.querySelector(".slot-num.now")?.parentElement?.textContent).toContain("What");
    expect(screen.getByLabelText("The brief")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next · Platforms" })).toBeInTheDocument();
    expect(screen.getByText(/nothing generates until you approve the plan/)).toBeInTheDocument();
    expect(container.querySelector(".brief-line")).not.toBeNull();
  });

  it("a brief that rode in opens Sources & media — the sheet's drawn state", async () => {
    server.use(planHandler());
    const { container } = render(<WizardSurface {...BASE} context={CONTEXT} />);

    expect(container.querySelector(".slot-num.now")?.parentElement?.textContent).toContain(
      "Sources & media",
    );
    // What summarizes the seeded brief with the pick's provenance.
    expect(screen.getByText(/from the Intel pick/)).toBeInTheDocument();
    // The capture is a grounding row with its source door.
    expect(screen.getByText(/Intel capture · Video as a build step/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "view ↗" })).toHaveAttribute("href", CONTEXT.sourceUrl);
  });

  it("platform chips carry the derivation's own verdicts — capability before spend", async () => {
    server.use(planHandler());
    const { container } = render(<WizardSurface {...BASE} context={CONTEXT} />);

    await waitFor(() => expect(container.querySelectorAll(".plat-chip").length).toBe(3));
    const chips = Array.from(container.querySelectorAll(".plat-chip"));
    const tiktok = chips.find((c) => c.textContent?.includes("TikTok"));
    expect(tiktok?.className).toContain("warn");
    expect(within(tiktok as HTMLElement).getByText("connect to publish")).toBeInTheDocument();
    // The verbatim refusal rides the title — the fix is named, not hidden.
    expect(tiktok?.getAttribute("title")).toContain("no connector in this build");
    const instagram = chips.find((c) => c.textContent?.includes("Instagram"));
    expect(instagram?.className).not.toContain("warn");
    expect(within(instagram as HTMLElement).getByText("✓ ready")).toBeInTheDocument();
  });

  it("a failed plan read says so — never fixture chips", async () => {
    server.use(http.post("/api/create/plan", () => HttpResponse.error()));
    const { container } = render(<WizardSurface {...BASE} context={CONTEXT} />);

    await waitFor(() =>
      expect(container.querySelector(".slot-sum")?.parentElement?.parentElement).not.toBeNull(),
    );
    await waitFor(() =>
      expect(screen.getByText(/plan derivation failed — open to retry/)).toBeInTheDocument(),
    );
    expect(container.querySelectorAll(".plat-chip")).toHaveLength(0);
  });

  it("excluding a platform re-derives the plan on the narrowed ask", async () => {
    const bodies: unknown[] = [];
    server.use(planHandler((b) => bodies.push(b)));
    const user = userEvent.setup();
    const { container } = render(<WizardSurface {...BASE} context={CONTEXT} />);

    await waitFor(() => expect(container.querySelectorAll(".plat-chip").length).toBe(3));
    // Open the Platforms slot — chips become toggles there.
    await user.click(screen.getByRole("button", { name: /Platforms/ }));
    const tiktok = screen.getByRole("button", { name: /TikTok/ });
    await user.click(tiktok);

    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(2));
    const last = bodies[bodies.length - 1] as { platforms?: string[] };
    expect(last.platforms).toEqual(["instagram", "facebook"]);
  });

  // s98 dogfood: the real plan route derives verdicts ONLY for the asked
  // platforms, so the narrowed re-read dropped the excluded chip and exclusion
  // became one-way. The mock narrows the same way the route does — the chip
  // must stay on the sheet, and the same click puts it back.
  it("an excluded platform stays on the sheet and one click puts it back", async () => {
    server.use(
      http.post("/api/create/plan", async ({ request }) => {
        const body = (await request.json()) as { platforms?: string[] };
        const platforms = body.platforms
          ? PLAN.platforms.filter((p) => body.platforms!.includes(p.platform))
          : PLAN.platforms;
        return HttpResponse.json({ plan: { ...PLAN, platforms } });
      }),
    );
    const user = userEvent.setup();
    const { container } = render(<WizardSurface {...BASE} context={CONTEXT} />);

    await waitFor(() => expect(container.querySelectorAll(".plat-chip").length).toBe(3));
    await user.click(screen.getByRole("button", { name: /Platforms/ }));
    await user.click(screen.getByRole("button", { name: /Instagram/ }));

    const excluded = await screen.findByRole("button", { name: /Instagram/ });
    expect(within(excluded).getByText("excluded")).toBeInTheDocument();
    expect(excluded).toHaveAttribute("aria-pressed", "false");

    await user.click(excluded);
    await waitFor(() =>
      expect(
        within(screen.getByRole("button", { name: /Instagram/ })).getByText("✓ ready"),
      ).toBeInTheDocument(),
    );
  });

  it("Review plan renders refusals verbatim, the real gates, and the cost with its grammar", async () => {
    server.use(planHandler());
    const user = userEvent.setup();
    render(<WizardSurface {...BASE} context={CONTEXT} />);

    await user.click(screen.getByRole("button", { name: "Next · Review plan" }));

    expect(await screen.findByText(/tiktok has no connector in this build/)).toBeInTheDocument();
    expect(screen.getByText(/Judge · g1 · g3_screen · g3_final/)).toBeInTheDocument();
    expect(screen.getByText(/Discoverability · render pipeline/)).toBeInTheDocument();
    expect(screen.getByText(/1 metered call\b/)).toBeInTheDocument();
  });

  it("cost honesty: no numbers means the reasons render as words, never a free-reading zero", async () => {
    server.use(
      http.post("/api/create/plan", () =>
        HttpResponse.json({
          plan: {
            ...PLAN,
            costPreview: { unestimated: ["staged video prices at direction time"] },
          },
        }),
      ),
    );
    const user = userEvent.setup();
    render(<WizardSurface {...BASE} context={CONTEXT} />);

    await user.click(screen.getByRole("button", { name: "Next · Review plan" }));
    expect(
      await screen.findByText(/cost — staged video prices at direction time/),
    ).toBeInTheDocument();
  });

  it("Generate dispatches the wizard brief through the one run door and doors to the Composer", async () => {
    let sent: unknown;
    server.use(
      planHandler(),
      http.post("/api/create", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({
          runId: "run-1",
          status: "complete",
          dispatched: true,
          children: [{ kind: "video_project", id: "vp-1" }],
          failures: [],
        });
      }),
    );
    const user = userEvent.setup();
    render(<WizardSurface {...BASE} context={CONTEXT} />);

    await user.click(screen.getByRole("button", { name: "Next · Review plan" }));
    await user.click(await screen.findByRole("button", { name: "Generate" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/Run recorded — 1 child/);
    expect(sent).toMatchObject({ family: "video", mode: "wizard" });
    expect(screen.getByRole("link", { name: "Open the run in the Composer →" })).toHaveAttribute(
      "href",
      "/app/create/run/run-1",
    );
  });

  it("a run-door refusal renders verbatim — the sequence gate speaks in its own words", async () => {
    server.use(
      planHandler(),
      http.post("/api/create", () =>
        HttpResponse.json(
          { error: "Live post generation isn’t wired to Create yet — waiting on the founder’s go-ahead." },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<WizardSurface {...BASE} context={CONTEXT} />);

    await user.click(screen.getByRole("button", { name: "Next · Review plan" }));
    await user.click(await screen.findByRole("button", { name: "Generate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/waiting on the founder’s go-ahead/);
  });

  it("post family arms Generate — the s98 dogfood GO opened the seam the wizard reads", async () => {
    server.use(planHandler());
    const user = userEvent.setup();
    render(<WizardSurface {...BASE} initialPrompt="a post" initialFamily="post" context={null} />);

    await user.click(screen.getByRole("button", { name: "Next · Review plan" }));
    const generate = await screen.findByRole("button", { name: "Generate" });
    expect(generate).toBeEnabled();
    expect(generate).toHaveAttribute(
      "title",
      expect.stringContaining("judge"),
    );
  });

  it("the media dialog is a stated deferral, never a dead button", async () => {
    server.use(planHandler());
    render(<WizardSurface {...BASE} context={CONTEXT} />);

    // The fact line exists…
    expect(screen.getByText(/the dialog lands with the media pass/)).toBeInTheDocument();
    // …and no control is dressed as the door.
    expect(screen.queryByRole("button", { name: /Select media/ })).not.toBeInTheDocument();
  });

  it("the tucked brief opens to the record that rides the run", async () => {
    server.use(planHandler());
    const user = userEvent.setup();
    const { container } = render(<WizardSurface {...BASE} context={CONTEXT} />);

    expect(container.querySelector(".brief-pop")).toBeNull();
    await user.click(container.querySelector(".brief-line") as HTMLElement);
    expect(screen.getByText("The brief — the exact record that rides the run")).toBeInTheDocument();
    expect(screen.getByText(/routing defaults decide/)).toBeInTheDocument();
  });

  it("Back to the prompt carries the brief home — nothing is re-asked (R2)", async () => {
    server.use(planHandler());
    render(<WizardSurface {...BASE} context={CONTEXT} />);

    const back = screen.getByRole("link", { name: "Back to the prompt →" });
    const href = back.getAttribute("href") ?? "";
    expect(href).toContain("/app/create?");
    expect(href).toContain("family=video");
    expect(href).toContain(`ctx=${CONTEXT.captureId}`);
    expect(href).toContain("prompt=Open+on+the+hook");
  });
});
