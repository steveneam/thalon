import { http, HttpResponse } from "msw";
import { fixtureDraftDetails, fixtureDraftsByRun, fixtureRuns } from "@/lib/approve-queue/fixtures";
import { fixtureHorizonCards } from "@/lib/intel/fixtures";
import {
  dismissTrendCard,
  IntelStoreError,
  listTrendCards,
  promoteTrendCard,
  targetSearchQuery,
} from "@/lib/intel/store";
import type { AreaRow, TargetRow } from "@/lib/intel/types";
import { fixtureActivity, fixturePulse, fixtureStatus } from "@/lib/workspace/fixtures";
import { parseStagedEditRequest, parseStagedPickRequest, runStaged } from "@/lib/staged-flow/http";
import {
  advanceStagedFlow,
  applyStagedEdit,
  getStagedDraftDetail,
  getStagedFlow,
  getStagedRunForFeed,
  listStagedRunDrafts,
  pickStagedCandidate,
  StagedFlowError,
} from "@/lib/staged-flow/store";

/**
 * The intel AREAS/TARGETS routes are real-repo-backed in dev, so component
 * tests get this minimal in-memory emulation instead (same wire shapes,
 * same status semantics); the trend/horizon handlers wrap the SAME
 * fake-driver store the real routes serve. Reset per test via
 * resetIntelTestState() in src/test/setup.ts.
 */
let testAreas: AreaRow[] = [];
let testTargets: TargetRow[] = [];
let intelSeq = 0;
const TEST_AT = "2026-07-05T12:00:00.000Z";

export function resetIntelTestState(): void {
  testAreas = [];
  testTargets = [];
  intelSeq = 0;
}

function intelError(err: unknown): Response {
  if (err instanceof IntelStoreError) {
    return HttpResponse.json({ error: err.message }, { status: err.httpStatus });
  }
  throw err;
}

/** Fetch-boundary mock seam for component development/tests — zero dependency on the engine/judge lanes (SPINE §5 lane map). The staged handlers wrap the SAME fake-driver store the /api/staged routes serve in dev, so tests and dev see one world. */
export const handlers = [
  // Shell/dashboard reads (B6.2).
  http.get("/api/app/pulse", () => HttpResponse.json(fixturePulse)),
  http.get("/api/app/activity", () => HttpResponse.json({ items: fixtureActivity })),
  http.get("/api/app/status", () => HttpResponse.json(fixtureStatus)),

  // Intel (B6.2): areas/targets emulated in-memory, trends/horizon via the shared fake-driver store.
  http.get("/api/intel/areas", () => HttpResponse.json({ areas: testAreas })),
  http.post("/api/intel/areas", async ({ request }) => {
    const body = (await request.json()) as { name?: string; description?: string };
    if (!body.name?.trim() || !body.description?.trim()) {
      return HttpResponse.json({ error: "An area needs a name and a description." }, { status: 400 });
    }
    const area: AreaRow = {
      id: `test-area-${++intelSeq}`,
      name: body.name,
      description: body.description,
      status: "active",
      config: {},
      createdAt: TEST_AT,
      updatedAt: TEST_AT,
    };
    testAreas.push(area);
    return HttpResponse.json({ area }, { status: 201 });
  }),
  http.patch("/api/intel/areas/:areaId", async ({ params, request }) => {
    const area = testAreas.find((a) => a.id === params.areaId);
    if (!area) return HttpResponse.json({ error: "area not found" }, { status: 404 });
    Object.assign(area, await request.json());
    return HttpResponse.json({ area });
  }),
  http.get("/api/intel/trends", () =>
    HttpResponse.json({ areas: testAreas, cards: listTrendCards(), demo: true }),
  ),
  http.post("/api/intel/trends/:cardId/dismiss", ({ params }) => {
    try {
      return HttpResponse.json({ capture: dismissTrendCard(params.cardId as string) });
    } catch (err) {
      return intelError(err);
    }
  }),
  http.post("/api/intel/trends/:cardId/promote", ({ params }) => {
    try {
      const { capture, promptSeed } = promoteTrendCard(params.cardId as string);
      return HttpResponse.json({
        capture,
        createHref: `/app/create?prompt=${encodeURIComponent(promptSeed)}`,
      });
    } catch (err) {
      return intelError(err);
    }
  }),
  http.get("/api/intel/search/targets", () => HttpResponse.json({ targets: testTargets })),
  http.post("/api/intel/search/targets", async ({ request }) => {
    const body = (await request.json()) as { keyword?: string };
    const keyword = body.keyword?.trim();
    if (!keyword) return HttpResponse.json({ error: "Enter a keyword to target." }, { status: 400 });
    const existing = testTargets.find((t) => t.keyword === keyword);
    if (existing) return HttpResponse.json({ target: existing, created: false }, { status: 200 });
    const target: TargetRow = {
      id: `test-target-${++intelSeq}`,
      keyword,
      origin: "operator",
      status: "active",
      meta: {},
      createdAt: TEST_AT,
      updatedAt: TEST_AT,
    };
    testTargets.push(target);
    return HttpResponse.json({ target, created: true }, { status: 201 });
  }),
  http.patch("/api/intel/search/targets/:targetId", async ({ params, request }) => {
    const target = testTargets.find((t) => t.id === params.targetId);
    if (!target) return HttpResponse.json({ error: "target not found" }, { status: 404 });
    const body = (await request.json()) as { status: TargetRow["status"] };
    target.status = body.status;
    return HttpResponse.json({ target });
  }),
  http.get("/api/intel/search/horizon", () =>
    HttpResponse.json({ cards: fixtureHorizonCards, demo: true }),
  ),
  http.post("/api/intel/search/target-this", async ({ request }) => {
    const body = (await request.json()) as { query: string };
    const { capture, promptSeed } = targetSearchQuery(body.query);
    return HttpResponse.json({
      capture,
      createHref: `/app/create?keyword=${encodeURIComponent(promptSeed)}`,
    });
  }),

  // The staged fixture run rides last (oldest) so the classic fixtures keep auto-selecting first.
  http.get("/api/runs", () => HttpResponse.json({ runs: [...fixtureRuns, getStagedRunForFeed()] })),

  http.get("/api/runs/:runId/drafts", ({ params }) => {
    const staged = listStagedRunDrafts(params.runId as string);
    if (staged) return HttpResponse.json({ drafts: staged });
    const drafts = fixtureDraftsByRun[params.runId as string] ?? [];
    return HttpResponse.json({ drafts });
  }),

  http.get("/api/drafts/:draftId", ({ params }) => {
    const staged = getStagedDraftDetail(params.draftId as string);
    if (staged) return HttpResponse.json(staged);
    const detail = fixtureDraftDetails[params.draftId as string];
    if (!detail) return HttpResponse.json({ error: "not found" }, { status: 404 });
    return HttpResponse.json(detail);
  }),

  http.get("/api/staged/:draftId/flow", ({ params }) => {
    const result = runStaged(() => {
      const flow = getStagedFlow(params.draftId as string);
      if (!flow) throw new StagedFlowError(`draft "${params.draftId as string}" belongs to no staged flow`, 404);
      return flow;
    });
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.post("/api/staged/:draftId/pick", async ({ params, request }) => {
    const parsed = parseStagedPickRequest(await request.json().catch(() => ({})));
    if ("error" in parsed) return HttpResponse.json({ error: parsed.error }, { status: 400 });
    const result = runStaged(() => pickStagedCandidate(params.draftId as string, parsed.request.candidateId));
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.post("/api/staged/:draftId/edit", async ({ params, request }) => {
    const parsed = parseStagedEditRequest(await request.json().catch(() => ({})));
    if ("error" in parsed) return HttpResponse.json({ error: parsed.error }, { status: 400 });
    const result = runStaged(() => applyStagedEdit(params.draftId as string, parsed.request));
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.post("/api/staged/:draftId/advance", ({ params }) => {
    const result = runStaged(() => advanceStagedFlow(params.draftId as string));
    return HttpResponse.json(result.body, { status: result.status });
  }),
];
