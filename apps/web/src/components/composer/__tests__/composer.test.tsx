// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComposerSurface } from "@/components/composer/composer";
import { server } from "@/lib/testing/server";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/create/run/cr1",
  useRouter: () => ({ push: vi.fn() }),
}));

const RUN = {
  id: "cr1",
  family: "post",
  mode: "prompt",
  brief: { prompt: "Launch film" },
  plan: {},
  children: [{ kind: "fanout_run", id: "fr1" }],
  status: "complete",
  lastError: null,
  createdAt: "2026-08-02T09:00:00Z",
};

const DRAFTS = [
  {
    id: "d-li",
    tenantId: "t1",
    fanoutRunId: "fr1",
    sourceId: "s1",
    platform: "linkedin",
    format: "single-post",
    body: "Nothing here is guaranteed to be faster on the first pass.",
    bodyHash: "h-li",
    meta: { targetTerms: ["deterministic video"] },
    status: "blocked",
    captureId: null,
    createdAt: "2026-08-02T10:00:00Z",
    updatedAt: "2026-08-02T10:00:00Z",
  },
  {
    id: "d-bs",
    tenantId: "t1",
    fanoutRunId: "fr1",
    sourceId: "s1",
    platform: "bluesky",
    format: "single-post",
    body: "Short and grounded.",
    bodyHash: "h-bs",
    meta: {},
    status: "queued",
    captureId: null,
    createdAt: "2026-08-02T10:00:00Z",
    updatedAt: "2026-08-02T10:00:00Z",
  },
];

const BLOCKED_DETAIL = {
  draft: DRAFTS[0],
  judgeResults: [
    {
      id: "j1",
      draftId: "d-li",
      gate: "g1",
      verdict: "fail",
      bodyHash: "h-li",
      evidence: {
        claims: [
          {
            verdict: "fail",
            evidence: "“guaranteed” is denylisted",
          },
        ],
      },
      createdAt: "2026-08-02T10:01:00Z",
    },
  ],
  approval: null,
};

function fitFor(platform: string, body: string) {
  const over = platform === "bluesky";
  return {
    supported: true,
    bodyHash: "x",
    suggestedAt: "2026-08-03T09:30:00Z",
    fit: {
      platform,
      fits: !over,
      problems: over ? [{ code: "over", message: "Over by 12. The last sentence gets cut." }] : [],
      text: {
        rawChars: body.length,
        billedChars: body.length,
        maxChars: platform === "bluesky" ? 300 : 3000,
        overBy: over ? 12 : 0,
        cutIndex: body.length,
        urlWeight: null,
        links: [],
        hashtags: [],
        maxHashtags: null,
        segments: [],
      },
      media: { count: 0, required: false },
    },
  };
}

beforeEach(() => {
  server.use(
    http.get("/api/create/runs/cr1", () => HttpResponse.json({ run: RUN, drafts: DRAFTS })),
    http.get("/api/drafts/:draftId", ({ params }) =>
      params.draftId === "d-li"
        ? HttpResponse.json(BLOCKED_DETAIL)
        : HttpResponse.json({ draft: DRAFTS[1], judgeResults: [], approval: null }),
    ),
    http.get("/api/social/fit", ({ request }) => {
      const id = new URL(request.url).searchParams.get("draftId");
      const draft = DRAFTS.find((d) => d.id === id);
      return draft
        ? HttpResponse.json(fitFor(draft.platform, draft.body))
        : HttpResponse.json({ error: "no draft" }, { status: 404 });
    }),
  );
});

/**
 * The Composer against Composer.dc.html (s90c): run-scoped open, every zone
 * naming its job, the judge's hit marked IN the body, refusal words
 * verbatim, and the AI-edit door that never lands unjudged.
 */
describe("ComposerSurface", () => {
  it("opens run-scoped: headline, would-block pill, tabs with dots, zones named", async () => {
    render(<ComposerSurface runId="cr1" />);
    await screen.findByText("Launch film — 2 destinations");

    expect(screen.getByText("would block · 1")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /LinkedIn/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Bluesky/ })).toBeInTheDocument();
    expect(screen.getByText("YOUR WORDS — EDITS RE-JUDGE")).toBeInTheDocument();
    expect(screen.getByText(/EVERY DESTINATION AT A GLANCE/)).toBeInTheDocument();
    expect(
      screen.getByText("The checkpoint before Approve — nothing publishes from here."),
    ).toBeInTheDocument();
  });

  it("marks the judge's hit IN the body and states the verdict in words", async () => {
    render(<ComposerSurface runId="cr1" />);
    await screen.findByText("would block");

    const hit = await screen.findByText("guaranteed", { selector: ".hit" });
    expect(hit).toBeInTheDocument();
    expect(screen.getByText("it gates — it never rewrites")).toBeInTheDocument();
  });

  // s98 dogfood: "would block" rode over a row of ✓ marks that named every
  // gate but the failing one — WHICH hard gate failed hid behind "details ▸".
  it("the verdict strip names the failing gate FIRST, wearing ✗", async () => {
    const { container } = render(<ComposerSurface runId="cr1" />);
    await screen.findByText("would block");

    await waitFor(() => {
      const facts = container.querySelectorAll(".jstrip-facts > span[title]");
      expect(facts.length).toBeGreaterThan(0);
      // The blocking gate is the first fact, by its bare word.
      expect(facts[0]?.textContent).toContain("✗");
      expect(facts[0]?.textContent).toContain("Denylist");
    });
  });

  it("a failed verdict read names itself — never an eternal “reading…”", async () => {
    server.use(http.get("/api/drafts/:draftId", () => HttpResponse.error()));
    const { container } = render(<ComposerSurface runId="cr1" />);
    await screen.findByText("would block");

    await screen.findByText("couldn’t read the verdicts — the record is on Approve");
    expect(container.textContent).not.toContain("reading the verdicts…");
  });

  it("the fit band carries each variant's own counter with its reason verbatim", async () => {
    render(<ComposerSurface runId="cr1" />);
    await screen.findByText("Launch film — 2 destinations");

    await screen.findByText("Fits. The body posts whole — no cut.");
    // The Bluesky variant is over — the engine's message, word for word.
    await screen.findByText("Over by 12. The last sentence gets cut.");
  });

  it("the AI-edit door surfaces a refusal VERBATIM at the control, text untouched", async () => {
    server.use(
      http.post("/api/drafts/d-li/ai-edit", () =>
        HttpResponse.json({
          status: "refused",
          reason: "the candidate judge refused the rewrite — the claim lost its grounding",
        }),
      ),
    );
    const user = userEvent.setup();
    render(<ComposerSurface runId="cr1" />);
    await screen.findByText("Launch film — 2 destinations");

    await user.click(screen.getByRole("button", { name: "AI edit…" }));
    await user.type(
      screen.getByPlaceholderText(/describe the change/),
      "make it punchier",
    );
    await user.click(screen.getByRole("button", { name: "Propose" }));

    await screen.findByText(
      /refused: the candidate judge refused the rewrite — the claim lost its grounding/,
    );
    // The operator's body is untouched.
    expect(screen.getByText("guaranteed", { selector: ".hit" })).toBeInTheDocument();
  });

  it("a run nothing records lands on the fact in words, with a door back", async () => {
    server.use(
      http.get("/api/create/runs/orphan", () =>
        HttpResponse.json(
          { error: "no create run records this id — the run predates Create or was a plain fan-out" },
          { status: 404 },
        ),
      ),
    );
    render(<ComposerSurface runId="orphan" />);
    await screen.findByText(/predates Create/);
    expect(screen.getByRole("link", { name: "back to Approve →" })).toBeInTheDocument();
  });
});
