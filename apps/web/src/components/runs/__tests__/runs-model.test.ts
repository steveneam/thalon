import { describe, expect, it } from "vitest";
import {
  applyRunView,
  dayHeading,
  filterRows,
  groupByDay,
  platformOptions,
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
    media: null,
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
    // Subject first, platforms second — the sheet's own lead grammar.
    expect(row.lead).toBe("a draft body · LinkedIn + X");
  });

  it("a run the plan hasn't answered for says so; a failed plan read falls back to the feed", () => {
    expect(runRow(run(RUN_ID, AT, true, 2), [], "loading").excerpt).toBe("reading the drafts…");
    expect(runRow(run(RUN_ID, AT, true, 2), [], "error").excerpt).toBe(
      "2 platforms requested · 2 waiting on you",
    );
  });

  /*
   * s77 finding (runs-model.ts:134): the lead was derived from PLATFORMS
   * alone, so 17 of 27 live rows read the identical "Fan-out · Video" and
   * eight consecutive rows in one day card were byte-identical. The sheet's
   * own leads are subject-first, and that is what these pin.
   */
  describe("the lead distinguishes one run from the next (s77 · runs-model:134)", () => {
    it("two runs on the same platforms read DIFFERENTLY when their drafts differ", () => {
      const video = { ...run("r-a", AT), platforms: ["video"] };
      const a = runRow(video, [asset({ runId: "r-a", excerpt: "Roast log: first crack at 8:52" })], "success");
      const b = runRow({ ...video, id: "r-b" }, [asset({ runId: "r-b", excerpt: "Switchboard one-clock scene" })], "success");
      expect(a.lead).not.toBe(b.lead);
      expect(a.lead).toBe("Roast log: first crack at 8:52 · Video");
      expect(b.lead).toBe("Switchboard one-clock scene · Video");
    });

    it("a long subject is cut at a WORD boundary, never mid-word", () => {
      const long =
        "Rendering the whole launch film from HTML turned out to be a build step, not a project";
      const lead = runRow(run(RUN_ID, AT), [asset({ excerpt: long })], "success").lead;
      expect(lead.endsWith("… · LinkedIn + X")).toBe(true);
      // The cut lands on a space, so no word is sliced in half.
      const topic = lead.slice(0, lead.indexOf("…"));
      expect(long.startsWith(topic)).toBe(true);
      expect(long[topic.length]).toBe(" ");
    });

    it("a run the plan window doesn't cover keeps the honest platform-only line", () => {
      expect(runRow(run(RUN_ID, AT), [], "success").lead).toBe("Fan-out · LinkedIn + X");
      expect(runRow({ ...run(RUN_ID, AT), platforms: [] }, [], "success").lead).toBe("Fan-out run");
    });
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

  /* The view knobs the founder asked to re-introduce (s77). */
  describe("the view knobs — platform filter, find, sort", () => {
    it("offers only platforms the feed actually recorded, label-ordered", () => {
      expect(platformOptions(rows)).toEqual(["linkedin", "x"]);
    });

    it("the platform filter narrows to the runs that requested it", () => {
      const only = rowsFor([{ ...run("r-3", AT), platforms: ["video"] }, run("r-4", AT)], [], "success");
      expect(
        applyRunView(only, { filter: "all", platform: "video", find: "", sort: "newest" }).map((r) => r.id),
      ).toEqual(["r-3"]);
    });

    it("find matches the text the row SHOWS — its lead and its excerpt", () => {
      expect(
        applyRunView(rows, { filter: "all", platform: null, find: "boom", sort: "newest" }).map((r) => r.id),
      ).toEqual(["r-1"]);
      expect(
        applyRunView(rows, { filter: "all", platform: null, find: "nothing here", sort: "newest" }),
      ).toHaveLength(0);
    });

    it("the knobs compose with the sheet's own All/Failed/Published seg", () => {
      expect(
        applyRunView(rows, { filter: "failed", platform: "linkedin", find: "", sort: "newest" }).map((r) => r.id),
      ).toEqual(["r-1"]);
      expect(
        applyRunView(rows, { filter: "published", platform: null, find: "boom", sort: "newest" }),
      ).toHaveLength(0);
    });

    it("'oldest' reverses BOTH the day groups and the rows inside them", () => {
      const now = new Date("2026-07-25T12:00:00.000Z");
      const newest = groupByDay(rows, now, "newest");
      const oldest = groupByDay(rows, now, "oldest");
      expect(newest.map((d) => d.key)).toEqual([...oldest.map((d) => d.key)].reverse());
      expect(oldest[0].rows[0].id).toBe("r-2");
    });
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

/* ── The W1 re-shape derivations (Runs.dc.html AMENDED s89) ── */

import {
  applyItemView,
  briefTopic,
  createParents,
  elapsedWord,
  liveRows,
  type DayItem,
} from "@/components/runs/runs-model";
import type { CreateRunWire } from "@/lib/create/client";

function createRun(overrides: Partial<CreateRunWire> = {}): CreateRunWire {
  return {
    id: "cr-1",
    family: "video",
    mode: "prompt",
    brief: { prompt: "launch film — one prompt to video plus posts" },
    plan: {},
    children: [],
    status: "complete",
    lastError: null,
    createdAt: AT,
    ...overrides,
  };
}

describe("the W1 re-shape (live band · create-run parents · five-state view)", () => {
  it("elapsed words are real math, never a fixture", () => {
    const now = new Date("2026-07-25T09:03:42.000Z");
    expect(elapsedWord("2026-07-25T09:03:30.000Z", now)).toBe("12s");
    expect(elapsedWord(AT, now)).toBe("3m 42s");
  });

  it("briefTopic reads only what the jsonb actually carries", () => {
    expect(briefTopic({ prompt: "a launch film" })).toBe("a launch film");
    expect(briefTopic({})).toBeNull();
    expect(briefTopic("not-an-object")).toBeNull();
  });

  it("a create run's family assets nest under it; the fanout rows it owns are absorbed", () => {
    const assets = [
      asset({ draftId: "d1", status: "queued" }),
      asset({ draftId: "d2", status: "blocked", judgedAt: "2026-07-25T09:02:00.000Z" }),
    ];
    const parent = createRun({ children: [{ kind: "fanout_run", id: RUN_ID }] });
    const { blocks, absorbedRunIds } = createParents([parent], assets);
    expect(absorbedRunIds.has(RUN_ID)).toBe(true);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].children.map((c) => c.draftId)).toEqual(["d1", "d2"]);
    expect(blocks[0].judgeTotal).toBe(2);
    expect(blocks[0].judgePassed).toBe(1);
    expect(blocks[0].waiting).toBe(2);
    expect(blocks[0].lead).toBe("Create run · launch film — one prompt to video plus posts");
    // The family door leads to the child run's queue.
    expect(blocks[0].href).toBe(`/app/approve?run=${RUN_ID}`);
  });

  it("an orphan family run is never given a fake parent", () => {
    const { blocks, absorbedRunIds } = createParents([], [asset({})]);
    expect(blocks).toHaveLength(0);
    expect(absorbedRunIds.size).toBe(0);
  });

  it("a child failure surfaces on the parent VERBATIM in the error channel", () => {
    const parent = createRun({
      children: [{ kind: "fanout_run", id: RUN_ID, error: "video mint refused: no source media" }],
    });
    const { blocks } = createParents([parent], []);
    expect(blocks[0].failed).toBe(true);
    expect(blocks[0].excerpt).toBe("video mint refused: no source media");
    expect(blocks[0].excerptError).toBe(true);
  });

  it("the live band takes in-flight work from BOTH reads, newest first; a create run gets no dead Watch door", () => {
    const now = new Date("2026-07-25T09:05:00.000Z");
    const liveFan = runRow({ ...run(RUN_ID, AT), status: "running" }, [], "success");
    const liveCreate = createRun({
      id: "cr-live",
      status: "running",
      createdAt: "2026-07-25T09:04:00.000Z",
    });
    const rows = liveRows([liveFan], [liveCreate], now);
    expect(rows.map((r) => r.id)).toEqual(["cr-live", RUN_ID]);
    expect(rows[0].href).toBeNull();
    expect(rows[1].href).toBe(`/app/approve?run=${encodeURIComponent(RUN_ID)}`);
  });

  it("the five-state view filters run rows and parent blocks by the same predicates", () => {
    const liveItem: DayItem = {
      type: "run",
      row: runRow({ ...run("r-live", AT), status: "running" }, [], "success"),
    };
    const waitingParent: DayItem = {
      type: "create",
      block: createParents(
        [createRun({ children: [{ kind: "fanout_run", id: RUN_ID }] })],
        [asset({ draftId: "d1", status: "queued" })],
      ).blocks[0],
    };
    const items = [liveItem, waitingParent];
    const view = { platform: null, find: "", sort: "newest" as const };
    expect(applyItemView(items, { ...view, filter: "live" })).toEqual([liveItem]);
    expect(applyItemView(items, { ...view, filter: "waiting" })).toEqual([waitingParent]);
    expect(applyItemView(items, { ...view, filter: "all" })).toHaveLength(2);
  });
});
