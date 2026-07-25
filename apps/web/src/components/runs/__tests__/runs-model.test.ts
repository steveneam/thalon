import { describe, expect, it } from "vitest";
import {
  dayHeading,
  filterRows,
  groupByDay,
  rowsFor,
  runRow,
  runsThisWeek,
} from "@/components/runs/runs-model";
import { run } from "@/lib/approve-queue/fixtures";
import type { PipelineAsset } from "@/lib/workspace/types";

const RUN_ID = "22222222-2222-2222-2222-222222222222";

function asset(overrides: Partial<PipelineAsset> = {}): PipelineAsset {
  return {
    draftId: `draft-${Math.abs(JSON.stringify(overrides).length)}-${overrides.status ?? "queued"}`,
    runId: RUN_ID,
    platform: "linkedin",
    format: null,
    status: "queued",
    sourceKind: "url",
    capturedAt: null,
    generatedAt: "2026-07-25T09:00:00.000Z",
    judgedAt: "2026-07-25T09:01:00.000Z",
    decidedAt: null,
    publishedAt: null,
    gates: [],
    reasons: [],
    deployRef: null,
    excerpt: "a draft body",
    ...overrides,
  };
}

const AT = "2026-07-25T09:00:00.000Z";

describe("runRow (the sheet's row grammar, honestly derived)", () => {
  it("renders a recorded failure VERBATIM in the error channel with the Failed pill", () => {
    const failing = {
      ...run("r-fail", AT),
      status: "failed",
      lastError: "IrrecoverableGenerationError: gateway 400 — malformed shell output",
    };
    const row = runRow(failing, [], "success");
    expect(row.excerpt).toBe("IrrecoverableGenerationError: gateway 400 — malformed shell output");
    expect(row.excerptError).toBe(true);
    expect(row.pill).toEqual({ tone: "err", label: "Failed" });
    expect(row.failed).toBe(true);
    // The sheet draws Retry on failed rows only — it rests unarmed (no route).
    expect(row.retryable).toBe(true);
  });

  it("counts a partial fan-out as triage-failed and says so, without inventing an error", () => {
    const row = runRow(run("r-partial", AT, false), [], "success");
    expect(row.pill).toEqual({ tone: "err", label: "Incomplete" });
    expect(row.excerpt).toContain("fewer drafts than platforms requested");
    expect(row.excerptError).toBe(false);
    expect(row.failed).toBe(true);
    // Nothing was recorded as failing, so nothing pretends a replay is owed.
    expect(row.retryable).toBe(false);
  });

  it("reads the judge block through the plan assets — reason in the error channel", () => {
    const row = runRow(
      run(RUN_ID, AT),
      [asset({ status: "blocked", reasons: ["no provided source supports this claim"] })],
      "success",
    );
    expect(row.pill).toEqual({ tone: "err", label: "Blocked" });
    expect(row.excerpt).toBe("Blocked by the judge — no provided source supports this claim");
    expect(row.excerptError).toBe(true);
  });

  it("published runs carry their live page (the sheet's '/blog/… ↗')", () => {
    const row = runRow(
      run(RUN_ID, AT),
      [
        asset({
          status: "approved",
          publishedAt: "2026-07-25T10:00:00.000Z",
          deployRef: "/blog/build-step-video",
          format: "web_page",
          platform: "web",
        }),
      ],
      "success",
    );
    expect(row.pill).toEqual({ tone: "ok", label: "Published" });
    expect(row.excerpt).toBe("Published");
    expect(row.liveHref).toBe("/blog/build-step-video");
    expect(row.published).toBe(true);
    expect(row.thumb).toBe("page hero");
  });

  it("waiting work wears the amber pill and the sheet's one-prompt excerpt", () => {
    const row = runRow(
      run(RUN_ID, AT),
      [asset({ status: "queued" }), asset({ status: "approved", decidedAt: AT })],
      "success",
    );
    expect(row.pill).toEqual({ tone: "warn", label: "1 waits" });
    expect(row.excerpt).toBe("One prompt → 2 drafts · 2 passed the judge · 1 waiting on you");
    expect(row.lead).toBe("Fan-out · LinkedIn + X");
  });

  it("a run the plan hasn't answered for says so; a failed plan read falls back to the feed", () => {
    expect(runRow(run(RUN_ID, AT, true, 2), [], "loading").excerpt).toBe("reading the drafts…");
    expect(runRow(run(RUN_ID, AT, true, 2), [], "error").excerpt).toBe(
      "2 platforms requested · 2 waiting on you",
    );
  });
});

describe("filters, day groups, and the week count", () => {
  const rows = rowsFor(
    [
      { ...run("r-1", "2026-07-25T09:00:00.000Z"), lastError: "boom" },
      run("r-2", "2026-07-24T16:20:00.000Z"),
    ],
    [
      asset({
        runId: "r-2",
        status: "approved",
        publishedAt: "2026-07-24T17:00:00.000Z",
        deployRef: "/blog/x",
      }),
    ],
    "success",
  );

  it("the Failed filter and the header count share ONE predicate", () => {
    expect(filterRows(rows, "failed").map((r) => r.id)).toEqual(["r-1"]);
    expect(rows.filter((r) => r.failed)).toHaveLength(1);
  });

  it("the Published filter is asset-truth, not run status", () => {
    expect(filterRows(rows, "published").map((r) => r.id)).toEqual(["r-2"]);
    expect(filterRows(rows, "all")).toHaveLength(2);
  });

  it("groups newest day first and marks today the sheet's way", () => {
    const now = new Date("2026-07-25T12:00:00.000Z");
    const days = groupByDay(rows, now);
    expect(days.map((d) => d.rows.length)).toEqual([1, 1]);
    expect(days[0].heading).toMatch(/^Today · /);
    expect(days[1].heading).not.toMatch(/^Today/);
    expect(dayHeading(new Date("2026-07-24T16:20:00.000Z"), now)).toBe("Friday 24 July");
  });

  it("'this week' is the workspace's Monday-start local week", () => {
    // 2026-07-25 is a Saturday; the Monday of that week is 2026-07-20.
    const now = new Date("2026-07-25T12:00:00.000Z");
    expect(runsThisWeek(rows, now)).toBe(2);
    expect(
      runsThisWeek(rowsFor([run("old", "2026-07-19T09:00:00.000Z")], [], "success"), now),
    ).toBe(0);
  });
});
