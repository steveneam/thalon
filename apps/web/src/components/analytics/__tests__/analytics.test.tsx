// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { Analytics } from "@/components/analytics/analytics";
import { server } from "@/lib/testing/server";
import type { AnalyticsModelWire, MetricCellWire, TileWire } from "../client";

/**
 * The exact-mock Analytics surface (Analytics.dc.html) over injected fakes.
 * What these tests pin is the sheet's own honesty contract in the rendered
 * DOM: absences are WORDS with the platform's reason behind them, a measured
 * zero is a zero, no row claims a feed-back that never happened, and dev
 * reality (empty publication_metrics) renders as honest empty states.
 */

const TO = "2026-07-25T14:38:00.000Z";
const FROM = "2026-06-27T14:38:00.000Z";
const PREV_FROM = "2026-05-30T14:38:00.000Z";

function dayIso(n: number): string {
  return new Date(Date.parse(FROM) + n * 86_400_000).toISOString();
}

function cell(over: Partial<MetricCellWire> = {}): MetricCellWire {
  return { value: null, parts: [], asOf: null, ...over };
}

function tile(over: Partial<TileWire> = {}): TileWire {
  return {
    value: null,
    previous: null,
    delta: null,
    deltaPct: null,
    platformsReporting: [],
    platformsNotReporting: [],
    asOf: null,
    ...over,
  };
}

const LINKEDIN_REASON =
  "partner-gated — post impressions live in organizationalEntityShareStatistics (Community Management API, partner-approved, rw_organization_admin) and cover ORGANISATION shares; we author member posts, which that endpoint does not describe";
const BLUESKY_REASON =
  "no impressions in the API — the AT Protocol's postView carries engagement counts only; Bluesky computes no view or impression number for anyone";
const X_REASON =
  'deferred until launch by founder ruling (2026-07-29, s87): "X analytics and posting bill will only be paid once thalon is ready to launch, so towards the end." The reader is built and works — this is "we won\'t yet", not "we can\'t" — and X reads are billed per resource, which is exactly the bill the ruling defers.';

/** A populated window: one measured Facebook post, LinkedIn gated, a Bluesky measured ZERO, X deferred. Every number injected. */
function populatedModel(): AnalyticsModelWire {
  return {
    window: { from: FROM, to: TO },
    previousWindow: { from: PREV_FROM, to: FROM },
    published: { count: 4, previous: 3, delta: 1 },
    audience: tile({
      value: 6410,
      previous: 0,
      delta: 6410,
      deltaPct: null, // a jump from nothing is not a percentage
      platformsReporting: ["facebook"],
      platformsNotReporting: [
        { platform: "bluesky", reason: BLUESKY_REASON, permanence: "structural" },
        { platform: "linkedin", reason: LINKEDIN_REASON, permanence: "gated" },
        { platform: "x", reason: X_REASON, permanence: "deferred" },
      ],
      asOf: TO,
    }),
    engagement: tile({
      value: 388,
      previous: 350,
      delta: 38,
      deltaPct: 10.857,
      platformsReporting: ["bluesky", "facebook"],
      platformsNotReporting: [
        { platform: "linkedin", reason: LINKEDIN_REASON, permanence: "gated" },
        { platform: "x", reason: X_REASON, permanence: "deferred" },
      ],
      asOf: TO,
    }),
    posts: [
      {
        publicationId: "pub-fb",
        draftId: "draft-fb",
        platform: "facebook",
        externalPostId: "ext-fb-1",
        publishedAt: dayIso(25),
        audience: cell({
          value: 6410,
          parts: [{ label: "reach", value: 6410, platformField: "post_total_media_view_unique" }],
          asOf: TO,
        }),
        engagement: cell({
          value: 388,
          parts: [
            { label: "clicks", value: 200, platformField: "post_clicks" },
            { label: "reactions", value: 188, platformField: "post_reactions_by_type_total" },
          ],
          asOf: TO,
        }),
        trend: {
          label: "reach",
          points: [
            { at: dayIso(22), value: 2100 },
            { at: dayIso(23), value: 3800 },
            { at: dayIso(24), value: 5200 },
            { at: dayIso(25), value: 6410 },
          ],
        },
        asOf: TO,
      },
      {
        publicationId: "pub-li",
        draftId: "draft-li",
        platform: "linkedin",
        externalPostId: "ext-li-1",
        publishedAt: dayIso(24),
        audience: cell({ reason: LINKEDIN_REASON, absence: "gated" }),
        engagement: cell({ reason: LINKEDIN_REASON, absence: "gated" }),
        trend: null,
        asOf: null,
      },
      {
        publicationId: "pub-bsky",
        draftId: "draft-bsky",
        platform: "bluesky",
        externalPostId: "ext-bsky-1",
        publishedAt: dayIso(23),
        audience: cell({ reason: BLUESKY_REASON, absence: "structural" }),
        // A platform that measured NOTHING HAPPENED: zero is a number, not an absence.
        engagement: cell({
          value: 0,
          parts: [{ label: "likes", value: 0, platformField: "likeCount" }],
          asOf: TO,
        }),
        trend: null,
        asOf: TO,
      },
      {
        publicationId: "pub-x",
        draftId: "draft-x",
        platform: "x",
        externalPostId: "ext-x-1",
        publishedAt: dayIso(22),
        audience: cell({ reason: X_REASON, absence: "deferred" }),
        engagement: cell({ reason: X_REASON, absence: "deferred" }),
        trend: null,
        asOf: null,
      },
    ],
    channels: [
      { platform: "bluesky", published: 1, audience: cell(), engagement: cell({ value: 0, asOf: TO }), reportsAudience: false, asOf: TO },
      { platform: "facebook", published: 1, audience: cell({ value: 6410, asOf: TO }), engagement: cell({ value: 388, asOf: TO }), reportsAudience: true, asOf: TO },
      { platform: "linkedin", published: 1, audience: cell(), engagement: cell(), reportsAudience: false, asOf: null },
      { platform: "x", published: 1, audience: cell(), engagement: cell(), reportsAudience: true, asOf: null },
    ],
    bound: { limit: 100, windowDays: 28, totalPublications: 14, truncated: false },
  };
}

function emptyModel(): AnalyticsModelWire {
  return {
    window: { from: FROM, to: TO },
    previousWindow: { from: PREV_FROM, to: FROM },
    published: { count: 0, previous: 0, delta: 0 },
    audience: tile(),
    engagement: tile(),
    posts: [],
    channels: [],
    bound: { limit: 100, windowDays: 28, totalPublications: 0, truncated: false },
  };
}

function seed(model: AnalyticsModelWire): string[] {
  const urls: string[] = [];
  server.use(
    http.get("/api/analytics", ({ request }) => {
      urls.push(request.url);
      return HttpResponse.json({ model });
    }),
    http.get("/api/app/plan", () =>
      HttpResponse.json({
        sweep: null,
        areas: 0,
        cadence: [],
        plannedSlots: [],
        assets: [
          {
            draftId: "draft-fb",
            runId: "run-1",
            platform: "facebook",
            format: "post",
            status: "approved",
            sourceKind: null,
            capturedAt: null,
            generatedAt: FROM,
            judgedAt: null,
            decidedAt: null,
            publishedAt: dayIso(25),
            gates: [],
            reasons: [],
            deployRef: null,
            excerpt: "Launch film — what deterministic video changes",
          },
        ],
      }),
    ),
  );
  return urls;
}

describe("Analytics (exact-mock rebuild, Analytics.dc.html)", () => {
  it("renders the sheet's bands with the honesty rules intact", async () => {
    seed(populatedModel());
    render(<Analytics />);

    expect(screen.getByRole("heading", { name: "Analytics" })).toBeInTheDocument();

    // The measured Facebook row: the number, its plan-read excerpt, and the
    // capability-truth provenance riding the cell's title verbatim.
    expect(await screen.findByText("Launch film — what deterministic video changes")).toBeInTheDocument();
    expect(screen.getAllByText("6,410").length).toBeGreaterThanOrEqual(1);
    const reachCell = screen.getByTitle(/post_total_media_view_unique/);
    expect(reachCell).toHaveTextContent("6,410");

    // Absences are WORDS, never zeros — each with the platform's own reason.
    expect(screen.getAllByText("partner-gated").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("no impressions in the API")).toBeInTheDocument();
    expect(screen.getAllByText("deferred").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByTitle(X_REASON).length).toBeGreaterThanOrEqual(2);

    // A measured ZERO is a zero (the Bluesky engagement cell), not a sentence.
    expect(screen.getByTitle(/likeCount/)).toHaveTextContent("0");

    // A jump from nothing is NOT a percentage — the raw delta shows.
    expect(screen.getByText("+6,410")).toBeInTheDocument();
    // A real comparison rounds to the sheet's whole-percent register.
    expect(screen.getByText("+11%")).toBeInTheDocument();

    // No row may claim the feed-back loop ran — it is not wired.
    expect(screen.getAllByText("pending").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("nothing to feed").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/✓ v\d/)).not.toBeInTheDocument();

    // The surface-wide as-of (s83b grammar) and the stated bound.
    expect(screen.getByText(/^as of \d{1,2} \w{3} \d{2}:\d{2} · platform APIs lag up to 48h$/)).toBeInTheDocument();
    expect(screen.getByText("4 of 14 shown · the rest fall outside 28 days")).toBeInTheDocument();

    // The chart names its members — and who is NOT in it — on the card.
    expect(screen.getByText(/Drawn over the 1 platform that reports reach \(Facebook\)\./)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Reach and engagement over the window" })).toBeInTheDocument();

    // The reserved hour box: explicitly empty, naming what it waits on.
    expect(screen.getByText("No hourly data yet")).toBeInTheDocument();
    expect(screen.getByText("arrives with publication_metrics · the metrics tick is not scheduled yet")).toBeInTheDocument();
  });

  it("renders dev reality — an empty publication_metrics — as honest empty states, not zeros", async () => {
    seed(emptyModel());
    render(<Analytics />);

    expect(
      await screen.findByText("Nothing published yet — approved posts land here once they ship."),
    ).toBeInTheDocument();
    expect(screen.getByText("no measurements yet — the metrics tick has not run")).toBeInTheDocument();
    expect(screen.getByText("No metric series yet — the metrics tick has not run.")).toBeInTheDocument();
    // Reach, Engagement and the steering tile are holes with sentences — never 0.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText("nothing published in this window").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("the metrics→profile loop isn't wired yet")).toBeInTheDocument();
  });

  it("a failed read is an alert with retry — never an empty history", async () => {
    seed(populatedModel());
    server.use(
      http.get("/api/analytics", () => new HttpResponse(null, { status: 500 }), { once: true }),
    );
    render(<Analytics />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t read the analytics");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Launch film — what deterministic video changes")).toBeInTheDocument();
  });

  it("a truncated read states that the deltas' baseline is incomplete", async () => {
    const model = populatedModel();
    model.bound.truncated = true;
    seed(model);
    render(<Analytics />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "The read stopped at 100 publications before reaching the previous window — the deltas compare against an incomplete baseline.",
    );
  });

  it("the platform knob narrows the table and the end-line says it was the knob", async () => {
    seed(populatedModel());
    render(<Analytics />);
    await screen.findByText("Launch film — what deterministic video changes");

    await userEvent.selectOptions(screen.getByLabelText("Platform filter"), "facebook");
    expect(screen.queryByText("partner-gated")).not.toBeInTheDocument();
    expect(screen.getByText(/narrowed by the platform filter/)).toBeInTheDocument();
    expect(screen.getByText("Platform ·")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove the platform filter" }));
    expect(screen.getAllByText("partner-gated").length).toBeGreaterThanOrEqual(2);
  });

  it("the window picker refetches with the chosen windowDays", async () => {
    const urls = seed(populatedModel());
    render(<Analytics />);
    await screen.findByText("Launch film — what deterministic video changes");
    expect(urls[0]).toContain("windowDays=28");

    await userEvent.selectOptions(screen.getByLabelText("Window length"), "7");
    await waitFor(() => {
      expect(urls.some((u) => u.includes("windowDays=7"))).toBe(true);
    });
  });
});
