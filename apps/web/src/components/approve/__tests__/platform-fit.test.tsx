// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { DraftCard } from "@/components/approve/draft-card";
import { draft, run, verdict } from "@/lib/approve-queue/fixtures";
import { server } from "@/lib/testing/server";

const RUN = run("11111111-1111-1111-1111-111111111111", "2026-07-04T09:00:00.000Z");
const PASSING = [verdict("g1", "pass", "h"), verdict("g3_final", "pass", "h")];

/** The fit shape the route returns, with the fields a test wants to vary. */
function fitBody(over: {
  fits: boolean;
  platform?: string;
  billedChars?: number;
  maxChars?: number;
  overBy?: number;
  cutIndex?: number;
  segments?: Array<{ kind: string; text: string; billed: number }>;
  problems?: Array<{ code: string; message: string }>;
  urlWeight?: number | null;
  links?: string[];
  hashtags?: string[];
}) {
  return {
    supported: true,
    bodyHash: "h",
    suggestedAt: "2026-07-29T09:00:00.000Z",
    fit: {
      platform: over.platform ?? "x",
      fits: over.fits,
      problems: over.problems ?? [],
      text: {
        rawChars: over.billedChars ?? 100,
        billedChars: over.billedChars ?? 100,
        maxChars: over.maxChars ?? 280,
        overBy: over.overBy ?? 0,
        cutIndex: over.cutIndex ?? 100,
        urlWeight: over.urlWeight ?? 23,
        links: over.links ?? [],
        hashtags: over.hashtags ?? [],
        maxHashtags: null,
        segments: over.segments ?? [{ kind: "text", text: "A fitting post.", billed: 15 }],
      },
      media: { count: 0, required: false, maxImages: 4, imageContentTypes: ["image/jpeg"] },
      capability: { verifiedOn: "2026-07-28" },
    },
  };
}

function useFit(body: Record<string, unknown>) {
  server.use(http.get("/api/social/fit", () => HttpResponse.json(body)));
}

function useQueue(rows: Array<Record<string, unknown>>) {
  server.use(http.get("/api/social/queue", () => HttpResponse.json({ rows })));
}

function renderCard(status: string, body = "A fitting post.") {
  return render(
    <DraftCard
      status="success"
      draft={draft("d1", RUN.id, "x", body, status, "h")}
      run={RUN}
      judgeResults={PASSING}
      busy={false}
      actionError={null}
      onApprove={() => {}}
      onReject={() => {}}
      onEditSave={() => {}}
      onReJudge={() => {}}
      onPublish={() => {}}
    />,
  );
}

/**
 * C1 wiring #2 + C4 — the fit line and the platform-true preview, both
 * powered ONLY by what the engine measured. Nothing in the browser counts
 * characters, so what the preview shows and what the Schedule verb accepts
 * are the same verdict by construction.
 */
describe("the fit line", () => {
  it("states the fit and its numbers when the post fits", async () => {
    useFit(fitBody({ fits: true, billedChars: 100, maxChars: 280 }));
    renderCard("queued");
    expect(await screen.findByText(/Fits X — 100 of 280 characters/)).toBeInTheDocument();
  });

  it("states the platform's REFUSAL verbatim when it does not fit", async () => {
    useFit(
      fitBody({
        fits: false,
        overBy: 47,
        problems: [
          { code: "text_over_ceiling", message: "X accepts 280 characters and this body bills 327 — 47 over." },
        ],
      }),
    );
    renderCard("queued");
    expect(
      await screen.findByText("X accepts 280 characters and this body bills 327 — 47 over."),
    ).toBeInTheDocument();
  });

  it("names X's link billing, which a raw character count would get wrong", async () => {
    useFit(fitBody({ fits: true, billedChars: 60, links: ["https://thalon.example/x"], urlWeight: 23 }));
    renderCard("queued");
    expect(await screen.findByText(/1 link billed at 23 each/)).toBeInTheDocument();
  });

  it("says the fit is UNKNOWN when the read fails — never that it passed", async () => {
    server.use(http.get("/api/social/fit", () => HttpResponse.json({ error: "down" }, { status: 500 })));
    renderCard("queued");
    expect(
      await screen.findByText(/the fit is unknown, not passing/),
    ).toBeInTheDocument();
  });

  it("is absent entirely for a platform with no capability row — a blog page has no ceiling", async () => {
    useFit({
      supported: false,
      platform: "blog",
      reason: '"blog" is not a social platform the capability matrix covers — there is no ceiling to measure this draft against.',
    });
    renderCard("queued");
    // The card settles into its normal state with no fit band at all.
    await waitFor(() =>
      expect(screen.queryByText(/Measuring this draft/)).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: "platform preview →" })).not.toBeInTheDocument();
    expect(screen.queryByText(/no ceiling to measure/)).not.toBeInTheDocument();
  });

  it("but SAYS the reason where its absence needs explaining — beside the missing Schedule verb", async () => {
    useFit({
      supported: false,
      platform: "blog",
      reason: '"blog" is not a social platform the capability matrix covers — there is no ceiling to measure this draft against.',
    });
    renderCard("approved");
    expect(await screen.findByText(/no ceiling to measure this draft against/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Schedule…" })).not.toBeInTheDocument();
  });
});

describe("the platform-true preview (a keeper STATE, behind the sheet's own → door)", () => {
  it("rests closed and opens on the door — the sheet's resting chrome is unchanged", async () => {
    useFit(fitBody({ fits: true }));
    renderCard("queued");
    const door = await screen.findByRole("button", { name: "platform preview →" });
    expect(door).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "Platform preview" })).not.toBeInTheDocument();

    await userEvent.click(door);
    expect(await screen.findByRole("group", { name: "Platform preview" })).toBeInTheDocument();
    expect(screen.getByText(/what X will render/)).toBeInTheDocument();
    // The matrix's own staleness stamp travels with the preview.
    expect(screen.getByText(/checked 2026-07-28/)).toBeInTheDocument();
  });

  it("shows WHERE the ceiling falls — the fact a plain body rendering cannot", async () => {
    useFit(
      fitBody({
        fits: false,
        overBy: 6,
        cutIndex: 6,
        billedChars: 12,
        maxChars: 6,
        segments: [{ kind: "text", text: "keptme cutme", billed: 12 }],
        problems: [{ code: "text_over_ceiling", message: "X accepts 6 characters." }],
      }),
    );
    const { container } = renderCard("queued");
    await userEvent.click(await screen.findByRole("button", { name: "platform preview →" }));

    const over = container.querySelector(".fit-over");
    expect(over?.textContent).toBe(" cutme");
    expect(container.querySelector(".fit-preview-body")?.textContent).toBe("keptme cutme");
    expect(screen.getByText(/X stops at 6/)).toBeInTheDocument();
  });

  it("marks links and hashtags the way the platform reads them", async () => {
    useFit(
      fitBody({
        fits: true,
        cutIndex: 30,
        segments: [
          { kind: "text", text: "see ", billed: 4 },
          { kind: "link", text: "https://a.example", billed: 23 },
          { kind: "text", text: " ", billed: 1 },
          { kind: "hashtag", text: "#thalon", billed: 7 },
        ],
      }),
    );
    const { container } = renderCard("queued");
    await userEvent.click(await screen.findByRole("button", { name: "platform preview →" }));
    expect(container.querySelector(".fit-link")?.textContent).toBe("https://a.example");
    expect(container.querySelector(".fit-tag")?.textContent).toBe("#thalon");
  });
});

describe("the Schedule verb (C2)", () => {
  it("is absent on a draft that is not approved — a commitment needs a decision first", async () => {
    useFit(fitBody({ fits: true }));
    renderCard("queued");
    await screen.findByText(/Fits X/);
    expect(screen.queryByRole("button", { name: "Schedule…" })).not.toBeInTheDocument();
  });

  it("appears on an approved, fitting draft, and says what a queue row IS", async () => {
    useFit(fitBody({ fits: true }));
    renderCard("approved");
    expect(await screen.findByRole("button", { name: "Schedule…" })).toBeInTheDocument();
    expect(
      screen.getByText(/a queue row is a commitment with a time — a plan is only an intention/),
    ).toBeInTheDocument();
  });

  it("is ABSENT while the post does not fit, and the card says why (fail-closed)", async () => {
    useFit(
      fitBody({
        fits: false,
        problems: [{ code: "text_over_ceiling", message: "X accepts 280 characters." }],
      }),
    );
    renderCard("approved");
    expect(await screen.findByText(/scheduling is absent while the post does not fit/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Schedule…" })).not.toBeInTheDocument();
  });

  it("commits through the queue door, pre-filled with the suggested instant", async () => {
    useFit(fitBody({ fits: true }));
    let posted: { draftId: string; platform: string; scheduledAt: string } | null = null;
    server.use(
      http.post("/api/social/queue", async ({ request }) => {
        posted = (await request.json()) as typeof posted;
        return HttpResponse.json({
          row: {
            id: "q1",
            draftId: "d1",
            platform: "x",
            scheduledAt: posted?.scheduledAt ?? null,
            status: "pending",
            lastError: null,
            createdAt: "2026-07-28T00:00:00.000Z",
            updatedAt: "2026-07-28T00:00:00.000Z",
          },
          created: true,
        });
      }),
    );
    renderCard("approved");
    await userEvent.click(await screen.findByRole("button", { name: "Schedule…" }));

    const field = screen.getByLabelText("Publish to X at") as HTMLInputElement;
    // The suggestion, not an invented default — derived from the operator's
    // own planned-slot rhythm server-side.
    expect(field.value).not.toBe("");
    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted!.platform).toBe("x");
    expect(posted!.draftId).toBe("d1");
  });

  it("surfaces the door's refusal verbatim instead of a generic failure", async () => {
    useFit(fitBody({ fits: true }));
    server.use(
      http.post("/api/social/queue", () =>
        HttpResponse.json(
          { error: 'draft "d1" is already queued for x at 2026-07-29T09:00:00.000Z — cancel that row' },
          { status: 409 },
        ),
      ),
    );
    renderCard("approved");
    await userEvent.click(await screen.findByRole("button", { name: "Schedule…" }));
    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("cancel that row");
  });

  it("shows a live row as SCHEDULED, states that nothing published, and offers the way back out", async () => {
    useFit(fitBody({ fits: true }));
    useQueue([
      {
        id: "q1",
        draftId: "d1",
        platform: "x",
        scheduledAt: "2026-07-29T09:00:00.000Z",
        status: "pending",
        lastError: null,
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      },
    ]);
    let cancelled = "";
    server.use(
      http.delete("/api/social/queue", ({ request }) => {
        cancelled = new URL(request.url).searchParams.get("id") ?? "";
        return HttpResponse.json({
          row: { id: "q1", draftId: "d1", platform: "x", scheduledAt: null, status: "cancelled", lastError: null, createdAt: "", updatedAt: "" },
        });
      }),
    );
    renderCard("approved");

    expect(await screen.findByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText(/committed, not published — the publisher is disarmed/)).toBeInTheDocument();
    // A commitment is reversible while it is still the operator's to reverse.
    await userEvent.click(screen.getByRole("button", { name: "Cancel schedule" }));
    await waitFor(() => expect(cancelled).toBe("q1"));
  });

  it("a FAILED row says why on its face, verbatim", async () => {
    useFit(fitBody({ fits: true }));
    useQueue([
      {
        id: "q1",
        draftId: "d1",
        platform: "x",
        scheduledAt: "2026-07-29T09:00:00.000Z",
        status: "failed",
        lastError: 'social publisher for "x" is DISARMED — missing arm(s): SOCIAL_X_ACCESS_TOKEN',
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      },
    ]);
    renderCard("approved");
    expect(await screen.findByText(/is DISARMED — missing arm\(s\): SOCIAL_X_ACCESS_TOKEN/)).toBeInTheDocument();
    // A terminal failure is not a live commitment — the withdraw verb is absent.
    expect(screen.queryByRole("button", { name: "Cancel schedule" })).not.toBeInTheDocument();
  });
});
