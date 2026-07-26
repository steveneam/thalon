// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));
import { draft as makeDraft, run as makeRun } from "@/lib/approve-queue/fixtures";
import type { LeadCard, LeadsPayload, TriageResult } from "@/lib/leads/types";
import { server } from "@/lib/testing/server";
import { LeadsSurface } from "../leads-surface";

function card(partial: Partial<LeadCard> = {}): LeadCard {
  return {
    id: "lead-1",
    source: "csv",
    email: "mara@fieldline.example",
    name: "Mara Kessler",
    company: "Fieldline Robotics",
    role: "Ops lead",
    website: "https://fieldline.example",
    notes: null,
    painPoint: "asked about content automation on the webinar",
    status: "scored",
    pinned: false,
    createdAt: "2026-07-18T02:00:00.000Z",
    score: 0.88,
    reasons: [
      'fit 0.92 (role "Ops lead" matches "ops"; vertical term "robotics" found)',
      "completeness 0.83 (5/6 contact fields present)",
      "recency 0.78 (captured 3.1d ago, half-life 30d)",
    ],
    scoredAt: "2026-07-22T02:00:00.000Z",
    profileHash: "icp-v1",
    weightStateId: null,
    extras: [],
    ...partial,
  };
}

function seedLeads(payload: Partial<LeadsPayload> = {}) {
  server.use(
    http.get("/api/leads", () =>
      HttpResponse.json({
        leads: [card()],
        scoringArmed: true,
        currentProfileHash: "icp-v1",
        learnedWeights: { state: null, staleForProfile: false },
        counts: { new: 0, scored: 1, dismissed: 0 },
        ...payload,
      } satisfies LeadsPayload),
    ),
  );
}

/** A composed outreach run + its judged draft, reachable through the existing run clients. */
function seedOutreach(leadId = "lead-1", status = "queued") {
  const runId = "99999999-9999-9999-9999-999999999999";
  server.use(
    http.get("/api/runs", () =>
      HttpResponse.json({
        runs: [{ ...makeRun(runId, "2026-07-22T03:00:00.000Z"), params: { leadId } }],
      }),
    ),
    http.get(`/api/runs/${runId}/drafts`, () =>
      HttpResponse.json({
        drafts: [
          makeDraft(
            "draft-out-1",
            runId,
            "email",
            "Your webinar question — the build-step answer\n\nYou asked whether launch content can run as a pipeline instead of a project.",
            status,
            "hash-out-1",
            {
              format: "outreach_email",
              meta: {
                subject: "Your webinar question — the build-step answer",
                emailBody:
                  "You asked whether launch content can run as a pipeline instead of a project.",
                recipient: { leadId, email: "mara@fieldline.example", name: "Mara Kessler" },
              },
            },
          ),
        ],
      }),
    ),
  );
}

/**
 * STEP 2 of the two-step rebuild: the sheet's bands (pinned structurally at
 * step 1) now carry the real queue. These pin the honesty rules — a
 * fabricated score, an invented activity timeline, a dead button or a
 * real-looking empty queue is a failure — plus the lead-score provenance
 * keeper, which re-enters as state behind byte-true chrome.
 */
describe("Leads (exact-mock rebuild — Leads.dc.html)", () => {
  it("renders the sheet's bands from the real queue: pills, rows, split and detail", async () => {
    seedLeads({ leads: [card(), card({ id: "lead-2", email: "jt@brightpath.example", name: "Jonah Tran", company: "Brightpath Clinics", role: "Marketing manager", painPoint: "downloaded the pipeline article", score: 0.81, pinned: true })], counts: { new: 0, scored: 2, dismissed: 0 } });
    const { container } = render(<LeadsSurface />);

    expect(screen.getByRole("heading", { name: "Leads" })).toHaveClass("t-headline");
    expect(await screen.findByText("2 scored")).toHaveClass("pill", "pill-idle");
    expect(screen.getByText("1 hot · follow up")).toHaveClass("pill", "pill-warn");

    const seg = container.querySelector(".seg");
    expect(Array.from(seg?.children ?? []).map((el) => el.textContent)).toEqual(["List", "Board"]);
    expect(seg?.querySelector(".seg-opt.on")?.textContent).toBe("List");

    // Two ranked rows; the hot pick floats first and starts selected.
    const rows = container.querySelectorAll(".split .row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveClass("sel");
    expect(rows[0].querySelector(".mono-badge")?.textContent).toBe("JT");
    expect(rows[0].querySelector(".lead-name")?.textContent).toBe("Jonah Tran · Brightpath Clinics");
    expect(rows[0].querySelector(".excerpt")?.textContent).toBe(
      "Marketing manager · downloaded the pipeline article",
    );
    expect(rows[0].querySelector<HTMLElement>(".bar-fill")?.style.width).toBe("81%");
    expect(rows[0].querySelector(".score-chip .t-data")?.textContent).toBe("0.81");

    // The detail card is the selected lead, with the sheet's id stamp.
    const head = container.querySelector(".card-head");
    expect(head?.querySelector(".t-title")?.textContent).toBe("Jonah Tran · Brightpath Clinics");
    expect(head?.querySelector(".pill-warn")?.textContent).toBe("follow up");
    expect(head?.querySelector(".t-data")?.textContent).toBe("#lead-2");

    expect(screen.getByText("best fit first · reasons on every score")).toHaveClass("t-label");
    expect(
      Array.from(container.querySelectorAll(".sec-label")).map((el) => el.textContent),
    ).toEqual(["Why this score", "Activity", "Drafted outreach — draft-only, never auto-sent"]);
  });

  it("why-this-score renders the scorer's own lines — signal, magnitude, reason, nothing paraphrased", async () => {
    seedLeads();
    const { container } = render(<LeadsSurface />);

    await screen.findByText("1 scored");
    const reasons = container.querySelectorAll(".reason");
    expect(reasons).toHaveLength(3);
    expect(reasons[0].querySelector(".rname")?.textContent).toBe("fit 0.92");
    expect(reasons[0].querySelector<HTMLElement>(".bar-fill")?.style.width).toBe("92%");
    expect(reasons[0].textContent).toContain('role "Ops lead" matches "ops"');
    // The untouched scorer line rides the row, so the split loses nothing.
    expect(reasons[0]).toHaveAttribute(
      "title",
      'fit 0.92 (role "Ops lead" matches "ops"; vertical term "robotics" found)',
    );
    expect(reasons[1].querySelector(".rname")?.textContent).toBe("completeness 0.83");
  });

  it("activity carries only what the spine records, and names what nothing stores yet", async () => {
    seedLeads();
    const { container } = render(<LeadsSurface />);

    await screen.findByText("1 scored");
    const activity = Array.from(container.querySelectorAll(".act-row")).map((el) => el.textContent);
    expect(activity[0]).toContain("Scored 0.88 against your ICP");
    expect(activity[0]).toContain("Wed · 22 Jul");
    expect(activity[1]).toContain("First seen — CSV import");
    expect(screen.getByText(/opens, clicks and replies need an engagement store/)).toBeInTheDocument();
  });

  it("an unscored lead says so — no invented grade, and the reason band says how to arm it", async () => {
    seedLeads({
      leads: [card({ score: null, reasons: [], scoredAt: null, status: "new", profileHash: null })],
      scoringArmed: false,
      currentProfileHash: null,
      counts: { new: 1, scored: 0, dismissed: 0 },
    });
    const { container } = render(<LeadsSurface />);

    expect(await screen.findByText("0 scored")).toBeInTheDocument();
    expect(container.querySelector(".score-chip .t-data")?.textContent).toBe("–");
    expect(container.querySelector(".score-chip .bar-fill")).toBeNull();
    expect(
      screen.getByText(/Not scored: your profile has no ICP block yet/),
    ).toBeInTheDocument();
  });

  it("a score from an older ICP is honestly stale, not silently current", async () => {
    seedLeads({ leads: [card({ profileHash: "icp-v0" })], currentProfileHash: "icp-v1" });
    render(<LeadsSurface />);

    expect(
      await screen.findByText("scored against an older ICP — Score now refreshes it"),
    ).toBeInTheDocument();
  });

  it("keyboard grammar: j/k move the selection, d dismisses with a way back, h marks hot", async () => {
    seedLeads({
      leads: [card(), card({ id: "lead-2", email: "b@x.example", name: "Bob Roe", score: 0.5 })],
      counts: { new: 0, scored: 2, dismissed: 0 },
    });
    const triage: Array<{ action: string; ids: string[] }> = [];
    server.use(
      http.post("/api/leads/triage", async ({ request }) => {
        triage.push((await request.json()) as { action: string; ids: string[] });
        return HttpResponse.json({ done: 1, failed: [] } satisfies TriageResult);
      }),
    );
    const user = userEvent.setup();
    const { container } = render(<LeadsSurface />);

    await screen.findByText("2 scored");
    expect(container.querySelector(".row.sel")?.textContent).toContain("Mara Kessler");
    await user.keyboard("j");
    expect(container.querySelector(".row.sel")?.textContent).toContain("Bob Roe");
    await user.keyboard("h");
    expect(triage).toEqual([{ action: "pin", ids: ["lead-2"] }]);

    await user.keyboard("d");
    expect(triage[1]).toEqual({ action: "dismiss", ids: ["lead-2"] });
    expect(await screen.findByText(/that verdict tunes the ranking/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View dismissed" })).toBeInTheDocument();
  });

  it("the provenance keeper rides behind the footer's ordering line: state, evidence, multipliers", async () => {
    seedLeads({
      leads: [card({ weightStateId: "state-old" })],
      learnedWeights: {
        state: {
          id: "2d86e475-1111-2222-3333-444444444444",
          computedAt: "2026-07-17T00:00:00.000Z",
          rows: 108,
          verdicts: 104,
          multipliers: { relevance: 1, fit: 2, completeness: 1, recency: 1 },
        },
        staleForProfile: false,
      },
    });
    const user = userEvent.setup();
    render(<LeadsSurface />);

    // Resting chrome is the sheet's line; the keeper is one disclosure behind it.
    const door = await screen.findByRole("button", { name: "best fit first · reasons on every score" });
    expect(screen.queryByTestId("weights-provenance")).not.toBeInTheDocument();
    await user.click(door);

    const panel = within(screen.getByTestId("weights-provenance"));
    expect(panel.getByText("Learned weights")).toBeInTheDocument();
    expect(panel.getByText(/state 2d86e475/)).toHaveTextContent(/104 verdicts \(108 triage rows\)/);
    expect(panel.getByText("×2.00")).toBeInTheDocument();
    expect(
      panel.getByText("1 of 1 scored lead riding older weights — Score now refreshes them"),
    ).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Learn from feedback" })).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Score now" })).toBeInTheDocument();
  });

  it("base weights, ICP drift and an unarmed scorer all read honestly in the same panel", async () => {
    seedLeads({
      scoringArmed: false,
      learnedWeights: { state: null, staleForProfile: true },
    });
    const user = userEvent.setup();
    render(<LeadsSurface />);

    await user.click(
      await screen.findByRole("button", { name: "best fit first · reasons on every score" }),
    );
    const panel = within(screen.getByTestId("weights-provenance"));
    expect(panel.getByText("Base weights")).toBeInTheDocument();
    expect(panel.getByText(/The ICP changed since weights were last learned/)).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Score now" })).toBeDisabled();
    expect(panel.getByRole("link", { name: "active profile" })).toHaveAttribute(
      "href",
      "/app/profiles",
    );
  });

  it("the lead → Create exits survive the rebuild as state behind the same disclosure", async () => {
    seedLeads();
    server.use(
      http.post("/api/leads/promote", () =>
        HttpResponse.json({ createHref: "/app/create?ctx=lead-capture-9" }),
      ),
    );
    const user = userEvent.setup();
    render(<LeadsSurface />);

    await user.click(
      await screen.findByRole("button", { name: "best fit first · reasons on every score" }),
    );
    const panel = within(screen.getByTestId("weights-provenance"));
    expect(
      panel.getByText(/Mara Kessler · Fieldline Robotics into Create/),
    ).toBeInTheDocument();
    await user.click(panel.getByRole("button", { name: "Video" }));

    expect(routerPush).toHaveBeenCalledWith("/app/create?ctx=lead-capture-9");
  });

  it("Learn from feedback hits the learn route and reports the outcome verbatim", async () => {
    seedLeads();
    server.use(
      http.post("/api/leads/learn", () =>
        HttpResponse.json({
          armed: true,
          rows: 12,
          verdicts: 12,
          stateId: "state-1",
          created: false,
          multipliers: null,
          reasons: [],
          profileHash: "icp-v1",
        }),
      ),
    );
    const user = userEvent.setup();
    render(<LeadsSurface />);

    await user.click(
      await screen.findByRole("button", { name: "best fit first · reasons on every score" }),
    );
    await user.click(screen.getByRole("button", { name: "Learn from feedback" }));

    expect(
      await screen.findByText("No change — the learned weights already reflect every verdict."),
    ).toBeInTheDocument();
  });

  it("intake rides behind the sheet's Import contacts button — CSV, the template, waitlist sync", async () => {
    seedLeads();
    server.use(
      http.post("/api/leads/sync-waitlist", () =>
        HttpResponse.json({
          sync: { seen: 3, added: 2, existing: 1 },
          scoring: { armed: true, candidates: 2, scored: 2, rescored: 0 },
        }),
      ),
    );
    const user = userEvent.setup();
    render(<LeadsSurface />);

    await user.click(await screen.findByRole("button", { name: "Import contacts" }));
    expect(screen.getByLabelText("CSV file")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "our minimal template" })).toHaveAttribute(
      "href",
      "/leads-template.csv",
    );

    await user.click(screen.getByRole("button", { name: "Sync waitlist" }));
    expect(await screen.findByText(/Waitlist synced: 2 new leads/)).toBeInTheDocument();
  });

  it("the drafted-outreach band reads the lead's own judged draft and hands the send to the operator", async () => {
    seedLeads();
    seedOutreach();
    const { container } = render(<LeadsSurface />);

    const mail = await screen.findByText(/You asked whether launch content/);
    expect(mail.closest(".mail")?.textContent).toContain("Mara Kessler <mara@fieldline.example>");
    expect(screen.getByText("judge passed")).toHaveClass("pill", "pill-ok");
    expect(screen.getByRole("link", { name: "Open in your mail client" })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:mara@fieldline.example?subject=Your%20webinar%20question"),
    );
    // Nothing sends from here, and call logging has no store — it says so.
    expect(screen.getByText("you send it — from your own mailbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log a call" })).toBeDisabled();
    expect(container.querySelectorAll(".mail")).toHaveLength(1);
  });

  it("a judge-blocked draft says so instead of wearing the pass pill", async () => {
    seedLeads();
    seedOutreach("lead-1", "blocked");
    render(<LeadsSurface />);

    expect(await screen.findByText("judge blocked")).toHaveClass("pill", "pill-err");
  });

  it("with no draft the band offers the compose door — never four dead buttons", async () => {
    seedLeads();
    let sent: unknown;
    server.use(
      http.post("/api/create/email", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({
          draftId: "d-1",
          runId: "r-1",
          status: "queued",
          alreadyComposed: false,
        });
      }),
    );
    const user = userEvent.setup();
    render(<LeadsSurface />);

    expect(await screen.findByText(/No draft yet\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy body" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Draft outreach" }));

    // The lead's own context grounds the brief — nothing is retyped.
    expect(sent).toMatchObject({
      leadId: "lead-1",
      context: {
        contact: "Mara Kessler",
        company: "Fieldline Robotics",
        role: "Ops lead",
        painPoint: "asked about content automation on the webinar",
        sourceUrl: "https://fieldline.example",
      },
    });
    expect(await screen.findByText(/Draft composed and judged/)).toBeInTheDocument();
  });

  it("a failed queue read is an alert with retry, never an empty queue", async () => {
    server.use(http.get("/api/leads", () => HttpResponse.error()));
    render(<LeadsSurface />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/read failure, not an empty queue/);
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText(/scored/)).not.toBeInTheDocument();
  });

  it("the Board tab renders the pipeline board, still honest that it is unwired", async () => {
    // s75: the founder directed the board be BUILT on the mock's grammar
    // (step 1 = structure, step 2 wires it next session), so the tab no
    // longer states a gap — it states that the board it draws is unwired.
    seedLeads();
    const user = userEvent.setup();
    const { container } = render(<LeadsSurface />);

    await user.click(await screen.findByRole("button", { name: "Board" }));
    expect(container.querySelector(".lead-board")).not.toBeNull();
    expect(container.querySelectorAll(".col")).toHaveLength(3);
    expect(screen.getByText(/isn’t wired yet/)).toBeInTheDocument();
  });

  it("carries no legacy bridge styling — the rebuilt surface speaks the sheet's classes", async () => {
    seedLeads();
    const { container } = render(<LeadsSurface />);

    await screen.findByText("1 scored");
    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-card"]')).toBeNull();
    expect(container.firstElementChild).toHaveClass("content", "leads-surface");
  });
});

describe("Leads — the empty queue", () => {
  it("names the three ways in without pretending the read failed", async () => {
    seedLeads({ leads: [], counts: { new: 0, scored: 0, dismissed: 0 } });
    render(<LeadsSurface />);

    expect(await screen.findByText(/No leads yet — import a CSV/)).toBeInTheDocument();
    expect(screen.getByText("No lead selected — the queue is empty.")).toBeInTheDocument();
  });
});
