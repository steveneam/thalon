// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { ApproveSurface } from "@/components/approve/approve-surface";
import { PulseProvider } from "@/components/workspace/pulse-context";
import {
  draftA,
  draftC,
  FIXTURE_DRAFT_A_ID,
  FIXTURE_DRAFT_B_ID,
  FIXTURE_DRAFT_C_ID,
  FIXTURE_RUN_1_ID,
  FIXTURE_RUN_2_ID,
  run,
} from "@/lib/approve-queue/fixtures";
import { server } from "@/lib/testing/server";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/approve",
}));

const ZERO_PULSE = {
  tenant: { slug: "self", name: "Thalon" },
  profile: { version: 1, company: "Thalon" },
  counts: { runs: 2, runsWithErrors: 0, drafts: 3, queued: 0, blocked: 0, approved: 3 },
  needsYou: 0,
};

describe("Approve (exact-mock rebuild, Approve.dc.html)", () => {
  it("renders the sheet's bands: header counts + view pickers + bulk approve, over queue × draft cards", async () => {
    render(<ApproveSurface />);

    // The header band: the headline, the two status pills on their own
    // channels, and the sheet's two pickers beside the bulk action.
    expect(screen.getByRole("heading", { name: "Approve" })).toBeInTheDocument();
    // Draft-level truth: the classic fixtures' queued draft + the staged
    // fixture's queued storyboard; one blocked.
    expect(await screen.findByText("2 waiting")).toBeInTheDocument();
    expect(screen.getByText("1 blocked")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort order" })).toHaveValue("newest");
    // W1: status moved from a header picker onto the queue card's tabs with
    // live counts; the header's second picker is the family lens.
    expect(screen.getByRole("combobox", { name: "Family filter" })).toHaveValue("all");
    expect(screen.getByRole("button", { name: /^All 4/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Waiting 2/ })).toBeInTheDocument();
    // …but a stage artifact advances through its own staged walk, so the
    // bulk action's count and the set it acts on agree at ONE.
    expect(screen.getByRole("button", { name: "Approve all waiting (1)" })).toBeInTheDocument();

    // The split: both cards, each labelled.
    const queue = screen.getByRole("region", { name: "Approve queue" });
    // Re-queried: the draft card remounts per draft (keyed-by-entity, s78).
    const detail = () => screen.getByRole("region", { name: "Draft detail" });

    // Rows speak the W1 sheet's grammar: a REAL platform mark (its name on
    // the title) · format word, status as a pill WORD, and the exact
    // creation stamp (never an age).
    await waitFor(() => expect(within(queue).getAllByTitle("LinkedIn").length).toBeGreaterThan(0));
    expect(within(queue).getAllByText(/post ·|post$/).length).toBeGreaterThan(0);
    expect(within(queue).getAllByText("Waiting").length).toBeGreaterThanOrEqual(1);
    // "Blocked" is now both a pill and a tab label — both are the vocabulary.
    expect(within(queue).getAllByText("Blocked").length).toBeGreaterThanOrEqual(1);
    expect(within(queue).getAllByText(/^\d{1,2} \w{3}.*, \d{2}:\d{2}$/).length).toBeGreaterThan(0);
    // The footer rail states the count and the keyboard legend.
    expect(within(queue).getByText("4 of 4")).toBeInTheDocument();
    for (const key of ["j", "k", "a", "r", "e"]) {
      expect(within(queue).getByText(key)).toBeInTheDocument();
    }

    // The draft card: version strip, checks band with its verbatim-reasons
    // door, and the provenance line stating the invariant in operator copy.
    await waitFor(() => within(detail()).getByText("Run2 X draft"));
    expect(within(detail()).getByText(/engine draft/)).toBeInTheDocument();
    // Named on the checks band, and again in the receipt this blocked draft
    // opens for itself.
    expect(within(detail()).getAllByText("Denylist").length).toBeGreaterThan(0);
    expect(within(detail()).getAllByText("Grounding — screen").length).toBeGreaterThan(0);
    expect(within(detail()).getByText(/the judge gates — it never rewrites/)).toBeInTheDocument();
  });

  it("a blocked draft quotes its failing reason VERBATIM — in the row and in the receipt", async () => {
    render(<ApproveSurface />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    // Re-queried: the draft card remounts per draft (keyed-by-entity, s78).
    const detail = () => screen.getByRole("region", { name: "Draft detail" });

    // The row's excerpt slot carries the judge's own words, not a paraphrase.
    expect(
      await within(queue).findByText(/no provided source supports this claim/),
    ).toBeInTheDocument();

    // A blocking failure opens the receipt without a click — a block must
    // state its reason — and the claim + evidence are recorded verbatim.
    const receipt = await waitFor(() => within(detail()).getByRole("group", { name: "Judge verdicts" }));
    expect(
      within(receipt).getByText(/Works with every platform — no provided source supports this claim/),
    ).toBeInTheDocument();
  });

  it("fail-closed: a blocked draft has NO approve/reject — absent, not greyed — and the rail states the rule", async () => {
    render(<ApproveSurface />);
    // Re-queried: the draft card remounts per draft (keyed-by-entity, s78).
    const detail = () => screen.getByRole("region", { name: "Draft detail" });
    await waitFor(() => within(detail()).getByText("Run2 X draft"));

    expect(within(detail()).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(within(detail()).queryByRole("button", { name: "Reject…" })).not.toBeInTheDocument();
    expect(within(detail()).getByText(/approve is absent while any check fails/)).toBeInTheDocument();
    // The ways forward stay: edit (the judge re-runs) and re-judge.
    expect(within(detail()).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(detail()).getByRole("button", { name: "Re-judge" })).toBeInTheDocument();
  });

  it("a queued draft wears the sheet's action rail: Approve · Edit · the consequence · Reject…", async () => {
    const user = userEvent.setup();
    render(<ApproveSurface />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    // Re-queried: the draft card remounts per draft (keyed-by-entity, s78).
    const detail = () => screen.getByRole("region", { name: "Draft detail" });

    await user.click(
      await within(queue).findByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_A_ID}` }),
    );
    await waitFor(() => within(detail()).getByText("Run2 LinkedIn draft"));

    expect(within(detail()).getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(within(detail()).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(detail()).getByRole("button", { name: "Reject…" })).toBeInTheDocument();
    expect(
      within(detail()).getByText("recorded — nothing publishes until the door arms"),
    ).toBeInTheDocument();
    // The seats: which profile version and which models shaped this draft.
    expect(within(detail()).getByText(/profile v1/)).toBeInTheDocument();
    expect(within(detail()).getByText(/drafted test\/model · judged test\/model/)).toBeInTheDocument();
  });

  it("selection drives the detail card, and the sort/filter pickers re-cut the view", async () => {
    const user = userEvent.setup();
    render(<ApproveSurface />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    // Re-queried: the draft card remounts per draft (keyed-by-entity, s78).
    const detail = () => screen.getByRole("region", { name: "Draft detail" });

    const names = () =>
      within(queue)
        .getAllByRole("button", { name: /^Select / })
        .map((row) => row.getAttribute("aria-label") ?? "");
    const indexOf = (id: string) => names().findIndex((n) => n.includes(id));

    // Newest first by default (founder s66) — the stable flatten, reversed.
    await waitFor(() => expect(names()[0]).toContain(FIXTURE_DRAFT_B_ID));
    expect(indexOf(FIXTURE_DRAFT_C_ID)).toBeLessThan(indexOf(FIXTURE_DRAFT_A_ID));

    // Flip to oldest-first: the walk inverts.
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort order" }), "oldest");
    await waitFor(() => expect(indexOf(FIXTURE_DRAFT_A_ID)).toBeLessThan(indexOf(FIXTURE_DRAFT_C_ID)));

    // Filter to waiting via the W1 state tab: the blocked and terminal rows
    // leave, and the footer states the honest filtered-of-total count.
    await user.click(screen.getByRole("button", { name: /^Waiting \d/ }));
    await waitFor(() => expect(indexOf(FIXTURE_DRAFT_B_ID)).toBe(-1));
    expect(indexOf(FIXTURE_DRAFT_C_ID)).toBe(-1);
    expect(within(queue).getByText(`${names().length} of 4`)).toBeInTheDocument();

    // Selection followed the view rather than stranding on a hidden row.
    await waitFor(() => within(detail()).getByText("Run2 LinkedIn draft"));
  });

  it("consumes a ?run= deep link: selection lands on that run's own waiting work", async () => {
    window.history.replaceState(null, "", `/app/approve?run=${FIXTURE_RUN_1_ID}`);
    try {
      render(<ApproveSurface />);
      await screen.findByRole("region", { name: "Draft detail" });
      // Re-queried: the draft card remounts per draft (keyed-by-entity, s78).
      const detail = () => screen.getByRole("region", { name: "Draft detail" });
      await waitFor(() => within(detail()).getByText("Run1 LinkedIn draft"));
    } finally {
      window.history.replaceState(null, "", "/app/approve");
    }
  });

  /*
   * s77 finding (runs-model.ts:133) — the half that lives on THIS surface. Every
   * Runs row is a door to `/app/approve?run=<id>`, including a failed run that
   * produced zero drafts. The deep link then matched nothing and fell silently
   * through to `defaultSelection`, so the operator landed on an unrelated run's
   * draft — under live Approve / Reject / Edit controls — with no cue the
   * request had missed. Reproduced on live data in s78 (run 7bc5254e, a failed
   * staged-video run with zero drafts). CROSS-LANE: Approve is lane 4's surface.
   */
  it("a ?run= that matches nothing SAYS so instead of silently selecting another run's draft", async () => {
    const MISSING_RUN = "aaaaaaaa-0000-0000-0000-000000000000";
    window.history.replaceState(null, "", `/app/approve?run=${MISSING_RUN}`);
    try {
      render(<ApproveSurface />);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/That run has no drafts in this queue/);
      expect(alert).toHaveTextContent(/the queue's own default is showing instead/i);
      // The operator gets back to where the door came from.
      expect(within(alert).getByRole("link", { name: "Back to Runs" })).toHaveAttribute(
        "href",
        "/app/runs",
      );
      // The queue is still usable — the fallback selection stands, it is just no
      // longer silent.
      await screen.findByRole("region", { name: "Draft detail" });
    } finally {
      window.history.replaceState(null, "", "/app/approve");
    }
  });

  /**
   * The half lane 1's cross-lane fix left: the deep-link check sat AFTER an
   * early return on an empty queue, so the one case where a `?run=` is most
   * obviously unresolvable was the one case with no alert at all.
   */
  it("says the deep link missed even when the queue is EMPTY", async () => {
    const MISSING_RUN = "aaaaaaaa-0000-0000-0000-000000000000";
    server.use(http.get("/api/runs", () => HttpResponse.json({ runs: [] })));
    window.history.replaceState(null, "", `/app/approve?run=${MISSING_RUN}`);
    try {
      render(<ApproveSurface />);
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/That run has no drafts in this queue/);
      expect(within(alert).getByRole("link", { name: "Back to Runs" })).toBeInTheDocument();
    } finally {
      window.history.replaceState(null, "", "/app/approve");
    }
  });

  /**
   * s77/s79 A1 — measured live: "13 waiting" beside "Approve all waiting
   * (2)", with nothing on screen naming the other 11. Both counts are true;
   * the sentence between them was missing.
   */
  it("names the gap between the header's waiting count and what batch approve acts on", async () => {
    render(<ApproveSurface />);
    // The fixtures carry two waiting drafts, one of them a stage artifact.
    expect(await screen.findByText("2 waiting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve all waiting (1)" })).toBeInTheDocument();
    expect(
      screen.getByText(
        /1 of 2 waiting can be approved together — 1 staged draft advances through its own flow/,
      ),
    ).toBeInTheDocument();
  });

  it("says nothing when the two counts agree — the sentence exists only for a real gap", async () => {
    server.use(
      http.get("/api/runs", () => HttpResponse.json({ runs: [run(FIXTURE_RUN_1_ID, "2026-07-03T09:00:00.000Z", true, 1)] })),
      http.get(`/api/runs/${FIXTURE_RUN_1_ID}/drafts`, () =>
        HttpResponse.json({ drafts: [{ ...draftA, status: "queued" }] }),
      ),
    );
    render(<ApproveSurface />);
    expect(await screen.findByText("1 waiting")).toBeInTheDocument();
    expect(screen.queryByText(/can be approved together/)).not.toBeInTheDocument();
  });

  it("a ?run= that DOES match says nothing at all — the band is absent at rest", async () => {
    window.history.replaceState(null, "", `/app/approve?run=${FIXTURE_RUN_1_ID}`);
    try {
      render(<ApproveSurface />);
      await screen.findByRole("region", { name: "Draft detail" });
      expect(screen.queryByText(/has no drafts in this queue/)).not.toBeInTheDocument();
    } finally {
      window.history.replaceState(null, "", "/app/approve");
    }
  });

  it("defaults to WAITING work across runs (run-count scoped), never merely the newest run", async () => {
    server.use(
      http.get("/api/runs", () =>
        HttpResponse.json({
          runs: [
            run(FIXTURE_RUN_2_ID, "2026-07-04T09:00:00.000Z", true, 0),
            run(FIXTURE_RUN_1_ID, "2026-07-03T09:00:00.000Z", true, 1),
          ],
        }),
      ),
      http.get(`/api/runs/${FIXTURE_RUN_1_ID}/drafts`, () =>
        HttpResponse.json({ drafts: [{ ...draftC, status: "queued" }] }),
      ),
    );
    render(<ApproveSurface />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    const rowC = await within(queue).findByRole("button", {
      name: `Select linkedin draft ${FIXTURE_DRAFT_C_ID}`,
    });
    await waitFor(() => expect(rowC).toHaveAttribute("aria-pressed", "true"));
    // Draft-level truth in the header pill: run 2's queued + run 1's queued.
    expect(screen.getByText("2 waiting")).toBeInTheDocument();
  });

  it("a failed queue read is an alert with retry — never a real-looking empty queue", async () => {
    server.use(http.get("/api/runs", () => HttpResponse.error()));
    render(<ApproveSurface />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Couldn’t read the queue/);
    expect(alert).toHaveTextContent(/read failure, not an empty queue/);
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("a failed detail read says so in the card instead of showing a blank pane", async () => {
    server.use(http.get(`/api/drafts/${FIXTURE_DRAFT_B_ID}`, () => HttpResponse.error()));
    render(<ApproveSurface />);
    // Re-queried: the draft card remounts per draft (keyed-by-entity, s78).
    const detail = () => screen.getByRole("region", { name: "Draft detail" });
    expect(await waitFor(() => within(detail()).getByText(/Couldn’t read this draft/))).toBeInTheDocument();
  });

  it("the queue states inbox zero when the shell pulse says nothing waits anywhere", async () => {
    server.use(
      http.get("/api/app/pulse", () => HttpResponse.json(ZERO_PULSE)),
      http.get("/api/runs", () => HttpResponse.json({ runs: [] })),
    );
    render(
      <PulseProvider>
        <ApproveSurface />
      </PulseProvider>,
    );
    expect(await screen.findByText("Inbox zero.")).toBeInTheDocument();
    expect(screen.getByText("Queue clear")).toBeInTheDocument();
  });

  it("an empty queue and a filtered-empty view say different, honest things", async () => {
    const user = userEvent.setup();
    server.use(http.get("/api/runs", () => HttpResponse.json({ runs: [] })));
    const { unmount } = render(<ApproveSurface />);
    expect(await screen.findByText("No drafts yet")).toBeInTheDocument();
    unmount();

    server.resetHandlers();
    server.use(
      http.get("/api/runs", () => HttpResponse.json({ runs: [run(FIXTURE_RUN_1_ID, "2026-07-03T09:00:00.000Z")] })),
      http.get(`/api/runs/${FIXTURE_RUN_1_ID}/drafts`, () => HttpResponse.json({ drafts: [draftC] })),
    );
    render(<ApproveSurface />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    await within(queue).findByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_C_ID}` });
    await user.click(screen.getByRole("button", { name: /^Waiting \d/ }));
    expect(await screen.findByText("Nothing matches this view")).toBeInTheDocument();
  });

  it("media-first: a media-bearing draft carries its placeholder slot; a plain post does not", async () => {
    const clip = {
      ...draftA,
      id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      format: "clip_plan",
      meta: {
        windowIndex: 0,
        chunkSeqs: [1],
        startMs: 12_000,
        endMs: 47_000,
        durationMs: 35_000,
        hook: "Hook line",
        captions: "Caption line",
        platformCopy: "Platform copy",
        promptVersion: "highlight-select.v1",
        brandProfileVersion: 1,
        platformProfileVersion: "brand-profile.v1",
      },
    };
    server.use(
      http.get(`/api/runs/${FIXTURE_RUN_2_ID}/drafts`, () => HttpResponse.json({ drafts: [clip] })),
    );
    render(<ApproveSurface />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    // The row's striped thumb names what belongs there (the backend carries
    // no media ref — placeholders over drift), and the clip window rides
    // the format word exactly as the sheet writes it.
    expect(await within(queue).findByText("clip frame")).toBeInTheDocument();
    // W1: the platform is a real MARK (name on its title); the clip window
    // still rides the format word exactly as the sheet writes it.
    expect(within(queue).getByText(/clip 0:12–0:47/)).toBeInTheDocument();
    expect(within(queue).getAllByTitle("LinkedIn").length).toBeGreaterThan(0);
  });
});
