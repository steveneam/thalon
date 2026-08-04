// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { ApproveSurface } from "@/components/approve/approve-surface";
import { StagedFlow } from "@/components/staged/staged-flow";
import { server } from "@/lib/testing/server";
import { FIXTURE_STORYBOARD_DRAFT_ID } from "@/lib/staged-flow/fixtures";

/**
 * The advanced-mode walk, end to end against the MSW seam: queue → staged
 * surface → rail navigation → candidate pick → direction editing → advance
 * gate → polish → final stage. The operator reacts to visible artifacts at
 * every step, and every interaction lands in the capture log.
 */
async function openStagedSurface(user: ReturnType<typeof userEvent.setup>) {
  render(<ApproveSurface />);
  await user.click(
    await screen.findByRole("button", { name: `Select video draft ${FIXTURE_STORYBOARD_DRAFT_ID}` }),
  );
  return await screen.findByRole("region", { name: "Staged video flow" });
}

describe("StagedFlow — the B5.4 advanced-mode surface", () => {
  it("selecting a stage-artifact draft swaps the detail pane for the staged surface, landing on the current stage's candidates", async () => {
    const user = userEvent.setup();
    const surface = await openStagedSurface(user);

    // The plain detail pane is gone; the plan's stages render as the rail.
    expect(screen.queryByRole("region", { name: "Draft detail" })).not.toBeInTheDocument();
    expect(within(surface).getByRole("button", { name: "View stage 1: Structure" })).toBeInTheDocument();
    expect(within(surface).getByRole("button", { name: "View stage 2: Scenes & effects" })).toBeInTheDocument();
    // Polish is locked until the flow reaches it.
    expect(within(surface).getByRole("button", { name: "View stage 3: Polish" })).toBeDisabled();

    // Current stage = scenes/effects, offering its 2–3 takes — never a blank prompt box.
    expect(within(surface).getByText("Kinetic typography")).toBeInTheDocument();
    expect(within(surface).getByText("Product walkthrough")).toBeInTheDocument();
    expect(within(surface).getByText("Illustrated gradients")).toBeInTheDocument();

    // The structural gate, mirrored in the UI: nothing to advance until a pick.
    // s101: inert verbs answer the press with a reason (the s81 grammar the
    // rest of the product uses) rather than going hard-disabled.
    expect(within(surface).getByRole("button", { name: "Generate Polish" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(within(surface).getByText("Pick a candidate to continue.")).toBeInTheDocument();
  });

  it("the rail navigates back to the judged storyboard, whose cards and preview are visible artifacts", async () => {
    const user = userEvent.setup();
    const surface = await openStagedSurface(user);

    await user.click(within(surface).getByRole("button", { name: "View stage 1: Structure" }));
    // s101: ONE scene index for both artifact formats (was "Storyboard cards"
    // plus a near-duplicate set of cards inside the direction editor).
    const scenes = within(surface).getByRole("group", { name: "Scenes" });
    expect(within(scenes).getByRole("button", { name: /Hook — the 3am dashboard/ })).toBeInTheDocument();
    // One scene open at a time: opening scene 2 reveals its narration.
    await user.click(within(scenes).getByRole("button", { name: /Scene 2: Problem/ }));
    expect(
      within(scenes).getByText("Teams stitch together five tools to answer one question."),
    ).toBeInTheDocument();
    // The preview seam renders the composed frame with the scene timeline.
    const preview = within(surface).getByRole("region", { name: "Stage preview" });
    expect(within(preview).getByRole("button", { name: "Preview scene 2: Problem" })).toBeInTheDocument();
  });

  it("pick → direction editor → judged queued → advance → polish candidates → final stage, captures counted throughout", async () => {
    const user = userEvent.setup();
    const surface = await openStagedSurface(user);

    // Pick a take: the stage resolves to a judged direction_doc draft.
    await user.click(within(surface).getByRole("button", { name: "Pick candidate Kinetic typography" }));
    await within(surface).findByRole("group", { name: "Direction" });
    expect(within(surface).getByText(/1 interaction/)).toBeInTheDocument();

    // A form tweak round-trips as a captured patch (pacing is a doc-level
    // style field). s101: the form sits behind "Edit direction" — at rest the
    // direction reads as chips, because five labelled inputs at this pane's
    // real width resolved to three 46.7px columns.
    await user.click(within(surface).getByRole("button", { name: "Edit direction" }));
    await user.selectOptions(within(surface).getByRole("combobox", { name: "Pacing" }), "fast");
    await within(surface).findByText(/2 interactions/);

    // The gate is open now (fake judge passed the pick + tweak) — advance to polish.
    await user.click(within(surface).getByRole("button", { name: "Generate Polish" }));
    await within(surface).findByText("Punchier on-screen copy");
    expect(within(surface).getByText("Tighter narration")).toBeInTheDocument();

    // Pick the polish take: final stage, export is core — no further advance.
    await user.click(within(surface).getByRole("button", { name: "Pick candidate Tighter narration" }));
    await within(surface).findByText(/Final stage — export to timeline\/SRT\/render manifest is deterministic core/);
    expect(within(surface).queryByRole("button", { name: /Generate/ })).not.toBeInTheDocument();
    expect(within(surface).getByText(/3 interactions/)).toBeInTheDocument();
  });

  it("per-beat accept chips capture the explicit no-change signal and mark the beat", async () => {
    const user = userEvent.setup();
    const surface = await openStagedSurface(user);

    await user.click(within(surface).getByRole("button", { name: "View stage 1: Structure" }));
    await user.click(within(surface).getByRole("button", { name: "Accept scene 1" }));
    await within(surface).findByRole("button", { name: "Accept scene 1", pressed: true });
    expect(within(surface).getByText(/1 interaction/)).toBeInTheDocument();
  });

  it("classic drafts keep the plain list + detail flow untouched", async () => {
    const user = userEvent.setup();
    render(<ApproveSurface />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    // Re-queried: the draft card remounts per draft (keyed-by-entity, s78).
    const detail = () => screen.getByRole("region", { name: "Draft detail" });
    // Newest-first view (s66) auto-selects the blocked draft — walk to the classic queued one.
    await user.click(await within(queue).findByRole("button", { name: /Select linkedin draft aaaaaaaa/ }));
    await waitFor(() => within(detail()).getByText("Run2 LinkedIn draft"));
    expect(screen.queryByRole("region", { name: "Staged video flow" })).not.toBeInTheDocument();
    // The staged chain rides the queue as its own row.
    const stagedRow = within(queue).getByRole("button", {
      name: `Select video draft ${FIXTURE_STORYBOARD_DRAFT_ID}`,
    });
    await user.click(stagedRow);
    await screen.findByRole("region", { name: "Staged video flow" });
  });
});

/**
 * s100 — THE STALLED LIVE CHAIN. Found by the founder on his own video run:
 * a one-prompt chain halted on a judge disagreement at stage 2 and the
 * surface offered him nothing at all — no reason beyond three gate chips, and
 * no door, because the pane deferred approve/reject/re-judge to "the draft
 * panel's own doors" long after it had REPLACED that panel.
 *
 * The payload below is the real shape of that run (GET .../flow on the live
 * projection), trimmed to what the surface reads.
 */
const LIVE_BLOCKED_DRAFT_ID = "6342b46d-fa4a-4688-941e-5916aaa18077";
const LIVE_ANCHOR_DRAFT_ID = "2c271514-196e-48d1-af69-8dd3df5b97bb";

function liveStalledFlow(blockedStatus: "blocked" | "queued" = "blocked") {
  const stageDef = (key: string, title: string, produces: string) => ({
    key,
    title,
    produces,
    promptSlug: `${key}.v1`,
  });
  const draft = (id: string, status: string, format: string) => ({
    id,
    tenantId: "t1",
    fanoutRunId: null,
    sourceId: null,
    platform: "video",
    format,
    body: "A 2.4 Trillion Parameter Week",
    bodyHash: "hash-1",
    meta: { title: "A 2.4 Trillion Parameter Week", scenes: [] },
    status,
    captureId: null,
    generationKey: "g1",
    createdAt: "2026-08-04T07:44:30.000Z",
    updatedAt: "2026-08-04T07:44:30.000Z",
  });
  return {
    source: "live",
    family: "video",
    plan: {
      family: "video",
      stages: [
        stageDef("structure", "Structure", "storyboard"),
        stageDef("scenes_effects", "Scenes & effects", "direction_doc"),
        stageDef("polish", "Polish", "direction_doc"),
      ],
    },
    stages: [
      {
        def: stageDef("structure", "Structure", "storyboard"),
        status: "done",
        draft: draft(LIVE_ANCHOR_DRAFT_ID, "queued", "storyboard"),
        judgeResults: [],
        candidates: null,
      },
      {
        def: stageDef("scenes_effects", "Scenes & effects", "direction_doc"),
        status: "current",
        draft: draft(LIVE_BLOCKED_DRAFT_ID, blockedStatus, "direction_doc"),
        judgeResults:
          blockedStatus === "blocked"
            ? [
                {
                  id: "j1",
                  tenantId: "t1",
                  draftId: LIVE_BLOCKED_DRAFT_ID,
                  gate: "g3_screen",
                  verdict: "fail",
                  bodyHash: "hash-1",
                  evidence: {
                    claims: [
                      { claim: "Swap the model underneath and the gates still hold.", verdict: "fail" },
                    ],
                  },
                  model: null,
                  promptVersion: null,
                  latencyMs: null,
                  createdAt: "2026-08-04T07:45:01.000Z",
                },
              ]
            : [],
        candidates: null,
      },
      {
        def: stageDef("polish", "Polish", "direction_doc"),
        status: "pending",
        draft: null,
        judgeResults: [],
        candidates: null,
      },
    ],
    currentIndex: 1,
    presets: [],
    captures: [],
  };
}

describe("StagedFlow — a LIVE chain that STOPPED (s100, the founder's video run)", () => {
  it("names the stage, quotes the judge's failing claim, and offers the one door that reaches a live draft", async () => {
    server.use(
      http.get(`/api/staged/${LIVE_ANCHOR_DRAFT_ID}/flow`, () =>
        HttpResponse.json(liveStalledFlow()),
      ),
    );
    render(<StagedFlow draftId={LIVE_ANCHOR_DRAFT_ID} />);
    const band = await screen.findByRole("alert", { name: "This run stopped" });

    // WHICH stage, and why nothing followed it.
    expect(band.textContent).toMatch(/stopped at/);
    expect(band.textContent).toMatch(/Scenes & effects/);
    expect(band.textContent).toMatch(/nothing further was generated/);
    // The judge's OWN words — not "a gate failed".
    expect(band.textContent).toMatch(/Swap the model underneath and the gates still hold\./);
    // And a door, which is the whole point: this used to be a dead end.
    expect(within(band).getByRole("button", { name: "Re-judge this stage" })).toBeInTheDocument();
  });

  it("re-judges the BLOCKED stage's draft — not the anchor the operator happened to select", async () => {
    let rejudged: string | null = null;
    server.use(
      http.get(`/api/staged/${LIVE_ANCHOR_DRAFT_ID}/flow`, () =>
        HttpResponse.json(liveStalledFlow(rejudged ? "queued" : "blocked")),
      ),
      http.post("/api/drafts/:draftId/rejudge", ({ params }) => {
        rejudged = params.draftId as string;
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    render(<StagedFlow draftId={LIVE_ANCHOR_DRAFT_ID} />);
    await user.click(await screen.findByRole("button", { name: "Re-judge this stage" }));

    // The anchor is the STORYBOARD (stage 1, queued); the block is on stage 2.
    // Re-judging what the operator clicked rather than what is blocked would
    // look like it worked and change nothing.
    await waitFor(() => expect(rejudged).toBe(LIVE_BLOCKED_DRAFT_ID));
    // Once the block clears the band is gone — it describes a state, not a place.
    await waitFor(() =>
      expect(screen.queryByRole("alert", { name: "This run stopped" })).not.toBeInTheDocument(),
    );
  });

  it("a live chain still mid-flight keeps its hands off — no band, no door", async () => {
    server.use(
      http.get(`/api/staged/${LIVE_ANCHOR_DRAFT_ID}/flow`, () =>
        HttpResponse.json(liveStalledFlow("queued")),
      ),
    );
    render(<StagedFlow draftId={LIVE_ANCHOR_DRAFT_ID} />);
    await screen.findByRole("region", { name: "Staged video flow" });

    expect(screen.queryByRole("button", { name: "Re-judge this stage" })).not.toBeInTheDocument();
    // The honest refusal, ONE sentence in the foot (s101) — and the verbs are
    // ABSENT rather than rendered-and-greyed: 26 of 41 controls used to ship
    // hard-disabled on a live run, a working editor's dress over nothing.
    expect(screen.getByText(/Stage editing reaches demo artifacts only/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit direction" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Accept scene/ })).not.toBeInTheDocument();
  });
});
