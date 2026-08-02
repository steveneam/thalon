import { describe, expect, it, vi } from "vitest";

/**
 * The Composer's run-scoped read: resolves a create-run id OR a child's id
 * (the Approve re-entry knows only the fanout run), joins the drafts
 * server-side, and answers a run that predates Create with the fact in
 * words — never a bare 404.
 */

const state: {
  runs: Array<Record<string, unknown>>;
  draftsByRun: Record<string, Array<Record<string, unknown>>>;
} = { runs: [], draftsByRun: {} };

vi.mock("@/lib/repos", () => ({
  getRepos: () =>
    Promise.resolve({
      createRuns: {
        get: (_ctx: unknown, id: string) => state.runs.find((r) => r.id === id) ?? null,
        list: () => state.runs,
      },
      drafts: {
        listByRun: (_ctx: unknown, id: string) => state.draftsByRun[id] ?? [],
        get: (_ctx: unknown, id: string) => ({ id, platform: "linkedin" }),
      },
    }),
}));
vi.mock("@/lib/tenant", () => ({
  resolveTenantCtx: () => Promise.resolve({ tenantId: "t1" }),
}));

const { GET } = await import("./route");

function get(runId: string): Promise<Response> {
  return GET(new Request(`http://localhost/api/create/runs/${runId}`), {
    params: Promise.resolve({ runId }),
  });
}

describe("GET /api/create/runs/[runId]", () => {
  it("joins a run's drafts across its child kinds, skipping errored children", async () => {
    state.runs = [
      {
        id: "cr1",
        children: [
          { kind: "fanout_run", id: "fr1" },
          { kind: "draft", id: "solo" },
          { kind: "fanout_run", id: "fr-dead", error: "dispatch refused" },
        ],
      },
    ];
    state.draftsByRun = { fr1: [{ id: "d1" }, { id: "d2" }] };

    const body = (await (await get("cr1")).json()) as { drafts: Array<{ id: string }> };
    expect(body.drafts.map((d) => d.id)).toEqual(["d1", "d2", "solo"]);
  });

  it("resolves a CHILD id to its parent run — the Approve re-entry's road", async () => {
    state.runs = [{ id: "cr1", children: [{ kind: "fanout_run", id: "fr1" }] }];
    state.draftsByRun = { fr1: [{ id: "d1" }] };

    const body = (await (await get("fr1")).json()) as { run: { id: string } };
    expect(body.run.id).toBe("cr1");
  });

  it("a run no create run records answers with the fact in words", async () => {
    state.runs = [];
    const res = await get("fr-orphan");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("predates Create");
  });

  it("malformed children jsonb degrades to an empty join, never a crash", async () => {
    state.runs = [{ id: "cr1", children: [{ bogus: true }] }];
    const body = (await (await get("cr1")).json()) as { drafts: unknown[] };
    expect(body.drafts).toEqual([]);
  });
});
