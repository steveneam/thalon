import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeSearchIntelSource } from "../fake-search-source";
import { gscSearchIntelSource } from "../gsc-source";
import { runHorizonScan, runSearchIntake } from "../intake";
import { getSearchIntelSource, registeredSearchIntelSources } from "../search-source";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

const NOW = 1_750_000_000_000;
const WEEK = 7 * 24 * 3_600_000;
const POLL = { startDate: "2026-06-22", endDate: "2026-06-29" };

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  return { ctx: tenantCtx(tenant.id), repos };
}

describe("SearchIntelSource registry (B6.8 seam — drivers are config)", () => {
  it("registers exactly fake, gsc, and the paid-vendor swap path", () => {
    expect(registeredSearchIntelSources()).toEqual(["fake", "gsc", "paid-vendor"]);
  });

  it("resolves explicitly by name, defaults to the keyless fake, and rejects unknown names loudly", () => {
    expect(getSearchIntelSource("gsc").name).toBe("gsc");
    expect(getSearchIntelSource().name).toBe("fake");
    expect(() => getSearchIntelSource("serp-scraper")).toThrow(/unknown search intel source/);
  });

  it("paid-vendor is a RECORDED swap path that fails loud, never a silent stub (ADR 0006)", () => {
    expect(() => getSearchIntelSource("paid-vendor")).toThrow(/recorded swap path, not built/);
  });
});

describe("fake source (keyless dogfood double)", () => {
  it("serves the built-in demo dataset when unconfigured — first-run dogfood works on an empty checkout", async () => {
    const rows = await createFakeSearchIntelSource().poll({ ...POLL });
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0]).toMatchObject({ query: "what is content automation" });
  });

  it("returns configured rows verbatim, defensively copied", async () => {
    const source = createFakeSearchIntelSource([{ query: "q", metrics: { impressions: 5 } }]);
    const first = await source.poll({ ...POLL });
    first[0].metrics.impressions = 999;
    const second = await source.poll({ ...POLL });
    expect(second[0].metrics.impressions).toBe(5);
  });
});

describe("gsc source skeleton (official Search Analytics shape; live wiring is B6.7)", () => {
  it("REFUSES to poll without explicit config — nothing runs before deploy+verification", async () => {
    await expect(gscSearchIntelSource().poll({ ...POLL })).rejects.toThrow(
      /not configured .* B6\.7/,
    );
  });

  it("maps the official response shape (keys per dimension, clicks/impressions/ctr/position) into rows", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      return new Response(
        JSON.stringify({
          rows: [
            {
              keys: ["what is content automation", "https://site.test/"],
              clicks: 1,
              impressions: 180,
              ctr: 0.005,
              position: 9.2,
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const source = gscSearchIntelSource({
      fetchImpl,
      config: { siteUrl: "sc-domain:site.test", accessToken: "test-token" },
    });
    const rows = await source.poll({ ...POLL, rowLimit: 500 });

    expect(rows).toEqual([
      {
        query: "what is content automation",
        page: "https://site.test/",
        metrics: { clicks: 1, impressions: 180, ctr: 0.005, position: 9.2 },
      },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Asite.test/searchAnalytics/query",
    );
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      startDate: "2026-06-22",
      endDate: "2026-06-29",
      dimensions: ["query", "page"],
      rowLimit: 500,
    });
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe(
      "Bearer test-token",
    );
  });

  it("a no-data window (rows omitted) is an empty poll, not an error", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({}), { status: 200 })) as typeof fetch;
    const source = gscSearchIntelSource({
      fetchImpl,
      config: { siteUrl: "sc-domain:site.test", accessToken: "t" },
    });
    expect(await source.poll({ ...POLL })).toEqual([]);
  });

  it("quota is config: a poll over the configured daily row quota refuses loudly", async () => {
    const source = gscSearchIntelSource({
      config: {
        siteUrl: "sc-domain:site.test",
        accessToken: "t",
        rowLimit: 25_000,
        dailyRowQuota: 10_000,
      },
    });
    await expect(source.poll({ ...POLL, rowLimit: 20_000 })).rejects.toThrow(
      /over the configured daily quota/,
    );
  });

  it("a non-2xx response fails loudly with the status", async () => {
    const fetchImpl = (async () => new Response("denied", { status: 403 })) as typeof fetch;
    const source = gscSearchIntelSource({
      fetchImpl,
      config: { siteUrl: "sc-domain:site.test", accessToken: "t" },
    });
    await expect(source.poll({ ...POLL })).rejects.toThrow(/gsc responded 403/);
  });
});

describe("runSearchIntake + runHorizonScan (append-only history → deterministic opportunities)", () => {
  it("polls, appends idempotent history, and the horizon scan flags the risen query with reasons", async () => {
    const { ctx, repos } = await setup();
    const week1 = createFakeSearchIntelSource([
      { query: "what is content automation", metrics: { clicks: 0, impressions: 100, ctr: 0, position: 11 } },
      { query: "acme motion studio", metrics: { clicks: 40, impressions: 200, ctr: 0.2, position: 1.2 } },
    ]);
    const week2 = createFakeSearchIntelSource([
      { query: "what is content automation", metrics: { clicks: 1, impressions: 180, ctr: 0.005, position: 9 } },
      { query: "acme motion studio", metrics: { clicks: 44, impressions: 210, ctr: 0.21, position: 1.3 } },
    ]);

    const first = await runSearchIntake(ctx, repos, { poll: POLL, nowMs: NOW }, { source: week1 });
    expect(first).toEqual({ polled: 2, snapshotsAppended: 2 });

    // Same-instant replay appends nothing (structural idempotency).
    const replay = await runSearchIntake(ctx, repos, { poll: POLL, nowMs: NOW }, { source: week1 });
    expect(replay.snapshotsAppended).toBe(0);

    const second = await runSearchIntake(
      ctx,
      repos,
      { poll: { startDate: "2026-06-29", endDate: "2026-07-06" }, nowMs: NOW + WEEK },
      { source: week2 },
    );
    expect(second.snapshotsAppended).toBe(2);

    // The capture is audited (B4.4 events spine).
    const events = await repos.events.list(ctx, { entityType: "search_snapshot", limit: 100 });
    expect(events.filter((e) => e.event === "search_snapshot.captured")).toHaveLength(4);

    const scan = await runHorizonScan(ctx, repos, { source: "fake" });
    expect(scan.series).toBe(2);
    expect(scan.opportunities.map((o) => o.query)).toEqual(["what is content automation"]);
    expect(scan.opportunities[0].reasons).toHaveLength(3);
    // The already-ranking query is scored transparently but not flagged.
    const ranking = scan.scored.find((s) => s.query === "acme motion studio")!;
    expect(ranking.isOpportunity).toBe(false);
  });

  it("rejects a malformed poll window at the boundary", async () => {
    const { ctx, repos } = await setup();
    await expect(
      runSearchIntake(
        ctx,
        repos,
        { poll: { startDate: "June 22", endDate: "2026-06-29" }, nowMs: NOW },
        { source: createFakeSearchIntelSource([]) },
      ),
    ).rejects.toThrow(/YYYY-MM-DD/);
  });
});
