import { METRIC_FAMILIES } from "@thalon/engine";
import { describe, expect, it } from "vitest";
import type { PipelineAsset } from "@/lib/workspace/types";
import {
  absenceWord,
  applyPostView,
  AUDIENCE_LABELS,
  cellView,
  chartView,
  dailyCumulative,
  endLine,
  fmtCount,
  measureTile,
  postViews,
  publishedTile,
  sparkPaths,
  steeringTile,
} from "../analytics-model";
import type { AnalyticsModelWire, MetricCellWire, PostRowWire, TileWire } from "../client";

/**
 * The sheet's honesty rules at the presentation layer — the last place a
 * lie could re-enter after the engine applied them:
 *   · `value === null` renders a sentence, `value === 0` renders a zero;
 *   · a delta from `previous: 0` is never a percentage;
 *   · a row with no series (or one capture) draws NOTHING;
 *   · provenance keeps the platform's own field name verbatim.
 * Every platform number here is an injected fake.
 */

const TO = "2026-07-25T14:38:00.000Z";
const FROM = "2026-06-27T14:38:00.000Z"; // exactly 28 days before TO
const PREV_FROM = "2026-05-30T14:38:00.000Z";

function dayIso(n: number): string {
  return new Date(Date.parse(FROM) + n * 86_400_000).toISOString();
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

function cell(over: Partial<MetricCellWire> = {}): MetricCellWire {
  return { value: null, parts: [], asOf: null, ...over };
}

let seq = 0;
function post(platform: string, over: Partial<PostRowWire> = {}): PostRowWire {
  seq += 1;
  return {
    publicationId: `pub-${seq}`,
    draftId: `draft-${seq}`,
    platform,
    externalPostId: `ext-${platform}-${seq}`,
    publishedAt: dayIso(2),
    audience: cell(),
    engagement: cell(),
    trend: null,
    asOf: null,
    ...over,
  };
}

function model(over: Partial<AnalyticsModelWire> = {}): AnalyticsModelWire {
  return {
    window: { from: FROM, to: TO },
    previousWindow: { from: PREV_FROM, to: FROM },
    published: { count: 0, previous: 0, delta: 0 },
    audience: tile(),
    engagement: tile(),
    posts: [],
    channels: [],
    bound: { limit: 100, windowDays: 28, totalPublications: 0, truncated: false },
    ...over,
  };
}

function asset(draftId: string, over: Partial<PipelineAsset> = {}): PipelineAsset {
  return {
    draftId,
    runId: "run-1",
    platform: "facebook",
    format: "post",
    status: "approved",
    sourceKind: null,
    capturedAt: null,
    generatedAt: FROM,
    judgedAt: null,
    decidedAt: null,
    publishedAt: dayIso(2),
    gates: [],
    reasons: [],
    deployRef: null,
    excerpt: "Launch film — what deterministic video changes",
    ...over,
  };
}

describe("the audience-label mirror", () => {
  it("matches the engine's METRIC_FAMILIES exactly — drift is a red test, not a chart quietly mixing families", () => {
    const engineAudience = new Set(
      Object.entries(METRIC_FAMILIES)
        .filter(([, family]) => family === "audience")
        .map(([label]) => label),
    );
    expect(AUDIENCE_LABELS).toEqual(engineAudience);
  });
});

describe("the number register", () => {
  it("renders the sheet's forms: 6,410 below 10k · 18.2k above · 1.5M", () => {
    expect(fmtCount(6410)).toBe("6,410");
    expect(fmtCount(18_200)).toBe("18.2k");
    expect(fmtCount(10_000)).toBe("10k");
    expect(fmtCount(999)).toBe("999");
    expect(fmtCount(1_500_000)).toBe("1.5M");
    expect(fmtCount(0)).toBe("0");
  });
});

describe("cells — null and 0 are DIFFERENT facts", () => {
  it("a measured zero is a zero", () => {
    const view = cellView(cell({ value: 0, parts: [{ label: "reach", value: 0, platformField: "reach" }], asOf: TO }));
    expect(view.kind).toBe("number");
    expect(view.text).toBe("0");
  });

  it("an absence is the platform's own word with the full reason behind it", () => {
    const reason =
      "partner-gated — post impressions live in organizationalEntityShareStatistics (Community Management API, partner-approved, rw_organization_admin) and cover ORGANISATION shares";
    const view = cellView(cell({ reason, absence: "gated" }));
    expect(view.kind).toBe("absence");
    expect(view.text).toBe("partner-gated");
    expect(view.title).toBe(reason);
  });

  it("Bluesky's structural absence leads with its stated clause", () => {
    expect(
      absenceWord(
        cell({
          reason:
            "no impressions in the API — the AT Protocol's postView carries engagement counts only; Bluesky computes no view or impression number for anyone",
          absence: "structural",
        }),
      ),
    ).toBe("no impressions in the API");
  });

  it("deferred is its own word — 'we won't yet', never 'not collected'", () => {
    const view = cellView(
      cell({
        reason:
          'deferred until launch by founder ruling (2026-07-29, s87): "X analytics and posting bill will only be paid once thalon is ready to launch, so towards the end."',
        absence: "deferred",
      }),
    );
    expect(view.text).toBe("deferred");
    expect(view.title).toContain("only be paid once thalon is ready to launch");
  });

  it("not_collected names the different fix", () => {
    expect(absenceWord(cell({ reason: "no reach recorded for this post yet — the metrics tick has not measured it", absence: "not_collected" }))).toBe(
      "not measured yet",
    );
  });

  it("a number's title carries the as-of and the platform's own field name verbatim", () => {
    const view = cellView(
      cell({
        value: 6410,
        parts: [{ label: "reach", value: 6410, platformField: "post_total_media_view_unique" }],
        asOf: TO,
      }),
    );
    // The day itself is timezone-local — assert the grammar, not the zone.
    expect(view.title).toMatch(/^as of \d{1,2} \w{3} \d{2}:\d{2}/);
    expect(view.title).toContain("post_total_media_view_unique");
  });
});

describe("post rows", () => {
  it("a row with no series — or a single capture — draws NOTHING", () => {
    const none = postViews(model({ posts: [post("bluesky")] }), [])[0];
    expect(none.trend).toBeNull();
    const one = postViews(
      model({
        posts: [post("facebook", { trend: { label: "reach", points: [{ at: dayIso(3), value: 100 }] } })],
      }),
      [],
    )[0];
    expect(one.trend).toBeNull();
    const two = postViews(
      model({
        posts: [
          post("facebook", {
            trend: {
              label: "reach",
              points: [
                { at: dayIso(3), value: 100 },
                { at: dayIso(9), value: 250 },
              ],
            },
          }),
        ],
      }),
      [],
    )[0];
    expect(two.trend?.values).toEqual([100, 250]);
  });

  it("no row may claim it fed back — measured rows read 'pending', unmeasured 'nothing to feed'", () => {
    const rows = postViews(
      model({
        posts: [
          post("facebook", { audience: cell({ value: 6410, parts: [], asOf: TO }) }),
          post("linkedin", { audience: cell({ reason: "partner-gated — …", absence: "gated" }) }),
        ],
      }),
      [],
    );
    expect(rows[0].feeds.text).toBe("pending");
    expect(rows[1].feeds.text).toBe("nothing to feed");
  });

  it("joins the plan read's excerpt by draftId, and falls back to what the wire knows", () => {
    const covered = post("facebook");
    const uncovered = post("bluesky");
    const rows = postViews(model({ posts: [covered, uncovered] }), [asset(covered.draftId)]);
    expect(rows[0].title).toBe("Launch film — what deterministic video changes");
    expect(rows[0].sub).toBe("post");
    expect(rows[1].title).toBe("Post on Bluesky");
    expect(rows[1].sub).toBe(uncovered.externalPostId);
  });

  it("a video asset earns the media chip; a text post draws none", () => {
    const vid = post("instagram");
    const txt = post("facebook");
    const rows = postViews(model({ posts: [vid, txt] }), [
      asset(vid.draftId, { format: "video_script" }),
      asset(txt.draftId),
    ]);
    expect(rows[0].media).toBe("clip");
    expect(rows[1].media).toBeNull();
  });
});

describe("view knobs", () => {
  it("absence cells sort LAST whatever the direction — a hole is not a small number", () => {
    const measured = post("facebook", { audience: cell({ value: 100, asOf: TO }) });
    const hole = post("linkedin", { audience: cell({ reason: "partner-gated — …", absence: "gated" }) });
    const rows = postViews(model({ posts: [hole, measured] }), []);
    const desc = applyPostView(rows, { platform: null, sort: "reach", dir: "desc" });
    const asc = applyPostView(rows, { platform: null, sort: "reach", dir: "asc" });
    expect(desc.map((r) => r.platform)).toEqual(["facebook", "linkedin"]);
    expect(asc.map((r) => r.platform)).toEqual(["facebook", "linkedin"]);
  });

  it("the platform knob narrows the rows", () => {
    const rows = postViews(model({ posts: [post("facebook"), post("bluesky")] }), []);
    expect(applyPostView(rows, { platform: "bluesky", sort: "sent", dir: "desc" })).toHaveLength(1);
  });
});

describe("sparklines", () => {
  it("fewer than two points has no shape", () => {
    expect(sparkPaths([], 58, 18)).toBeNull();
    expect(sparkPaths([7], 58, 18)).toBeNull();
  });

  it("a genuinely flat measured series draws a mid line — measured sameness, not fabricated zero", () => {
    const paths = sparkPaths([5, 5, 5], 58, 18);
    expect(paths?.line).toContain(",9");
  });
});

describe("the daily reconstruction (chart + tile shapes)", () => {
  const fb = post("facebook", {
    trend: {
      label: "reach",
      points: [
        { at: dayIso(3), value: 100 },
        { at: dayIso(10), value: 250 },
      ],
    },
  });
  const ig = post("instagram", {
    trend: { label: "reach", points: [{ at: dayIso(5), value: 50 }] },
  });
  const bsky = post("bluesky", {
    trend: {
      label: "likes",
      points: [
        { at: dayIso(4), value: 9 },
        { at: dayIso(12), value: 12 },
      ],
    },
  });
  const m = model({
    posts: [fb, ig, bsky],
    channels: [
      { platform: "bluesky", published: 1, audience: cell(), engagement: cell(), reportsAudience: false, asOf: null },
      { platform: "facebook", published: 1, audience: cell(), engagement: cell(), reportsAudience: true, asOf: null },
      { platform: "instagram", published: 1, audience: cell(), engagement: cell(), reportsAudience: true, asOf: null },
    ],
  });

  it("carries each post's last-known value forward and sums per day — families never mix", () => {
    const reach = dailyCumulative(m, "audience");
    expect(reach.platforms).toEqual(["facebook", "instagram"]);
    expect(reach.values).toHaveLength(28);
    expect(reach.values[0]).toBe(0); // before any capture, nothing was known
    expect(reach.values[6]).toBe(150); // fb@100 + ig@50
    expect(reach.values[27]).toBe(300); // fb@250 + ig@50
    const engagement = dailyCumulative(m, "engagement");
    expect(engagement.platforms).toEqual(["bluesky"]);
    expect(engagement.values[27]).toBe(12);
  });

  it("the chart tip names every line's members — and who is NOT in it", () => {
    const chart = chartView(m);
    expect(chart.tip).toContain("Drawn over the 2 platforms that report reach (Facebook, Instagram).");
    expect(chart.tip).toContain("Bluesky is not in it");
    expect(chart.tip).toContain("The engagement line covers Bluesky");
  });

  it("no series → no lines and the tip says why", () => {
    const chart = chartView(model({ posts: [post("facebook")] }));
    expect(chart.reach).toBeNull();
    expect(chart.engagement).toBeNull();
    expect(chart.tip).toContain("the metrics tick has not measured anything");
  });
});

describe("tiles", () => {
  it("a delta from previous 0 is NOT a percentage — the raw delta shows", () => {
    const view = measureTile(
      model({
        audience: tile({ value: 6410, previous: 0, delta: 6410, deltaPct: null, platformsReporting: ["facebook"] }),
        channels: [
          { platform: "facebook", published: 1, audience: cell(), engagement: cell(), reportsAudience: true, asOf: null },
        ],
      }),
      "audience",
    );
    expect(view.delta?.text).toBe("+6,410");
    expect(view.delta?.text).not.toContain("%");
  });

  it("a real comparison renders the percentage", () => {
    const view = measureTile(
      model({ audience: tile({ value: 1200, previous: 1000, delta: 200, deltaPct: 20, platformsReporting: ["instagram"] }) }),
      "audience",
    );
    expect(view.delta?.text).toBe("+20%");
  });

  it("nothing measured is a hole with a sentence — never a 0 that reads real", () => {
    const view = measureTile(
      model({
        posts: [post("linkedin")],
        channels: [
          { platform: "linkedin", published: 1, audience: cell(), engagement: cell(), reportsAudience: false, asOf: null },
        ],
        audience: tile({
          platformsNotReporting: [{ platform: "linkedin", reason: "partner-gated — …", permanence: "gated" }],
        }),
      }),
      "audience",
    );
    expect(view.fact).toBe("—");
    expect(view.note).toBe("nothing measured yet — the metrics tick has not run");
    expect(view.title).toContain("LinkedIn — partner-gated");
  });

  it("the engagement footnote names who is excluded", () => {
    const view = measureTile(
      model({
        engagement: tile({
          value: 946,
          platformsReporting: ["bluesky", "facebook"],
          platformsNotReporting: [{ platform: "linkedin", reason: "partner-gated — …", permanence: "gated" }],
        }),
        channels: [
          { platform: "bluesky", published: 1, audience: cell(), engagement: cell(), reportsAudience: false, asOf: null },
          { platform: "facebook", published: 1, audience: cell(), engagement: cell(), reportsAudience: true, asOf: null },
          { platform: "linkedin", published: 1, audience: cell(), engagement: cell(), reportsAudience: false, asOf: null },
        ],
      }),
      "engagement",
    );
    expect(view.note).toBe("2 of 3 platforms · LinkedIn excluded");
  });

  it("Published is complete from our own rows; a zero delta shows nothing", () => {
    const view = publishedTile(model({ published: { count: 14, previous: 10, delta: 4 } }));
    expect(view.fact).toBe("14");
    expect(view.delta?.text).toBe("+4");
    expect(publishedTile(model({ published: { count: 3, previous: 3, delta: 0 } })).delta).toBeNull();
  });

  it("the steering tile renders the unwired loop as a sentence, never a fabricated count", () => {
    const view = steeringTile(model({ published: { count: 14, previous: 10, delta: 4 } }));
    expect(view.fact).toBe("—");
    expect(view.delta?.text).toBe("of 14");
    expect(view.note).toContain("isn't wired yet");
  });
});

describe("the end-of-data line", () => {
  it("states the bound instead of reading as 'everything'", () => {
    const m = model({
      posts: [post("facebook")],
      bound: { limit: 100, windowDays: 28, totalPublications: 14, truncated: false },
    });
    expect(endLine(m, 1, false)).toBe("1 of 14 shown · the rest fall outside 28 days");
  });

  it("a truncated read says the deltas' baseline is incomplete territory", () => {
    const m = model({ bound: { limit: 100, windowDays: 28, totalPublications: 300, truncated: true } });
    expect(endLine(m, 100, false)).toContain("the read stopped at 100 publications");
  });

  it("an operator-narrowed view says it was the knob", () => {
    const m = model({ posts: [post("facebook"), post("bluesky")] });
    expect(endLine(m, 1, true)).toContain("narrowed by the platform filter");
  });
});
