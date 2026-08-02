import { http, HttpResponse } from "msw";
import { fixtureDraftDetails, fixtureDraftsByRun, fixtureRuns } from "@/lib/approve-queue/fixtures";
import { fixtureHorizonCards, fixtureSweep } from "@/lib/intel/fixtures";
import {
  dismissTrendCard,
  IntelStoreError,
  listTrendCards,
  promoteTrendCard,
  resolveCreateContext,
  targetSearchQuery,
} from "@/lib/intel/store";
import type { AreaRow, CreateFamily, TargetRow } from "@/lib/intel/types";
import type { LibrarySourceRow, WireSegment } from "@/lib/library/types";
import type { ProfileHistoryEntry, ProfileWire } from "@/lib/profiles/types";
import { fixtureActivity, fixturePlan, fixturePulse, fixtureStatus } from "@/lib/workspace/fixtures";
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

let testProfile: ProfileWire | null = null;
let testProfileHistory: ProfileHistoryEntry[] = [];

export function resetIntelTestState(): void {
  testAreas = [];
  testTargets = [];
  intelSeq = 0;
  testProfile = null;
  testProfileHistory = [];
}

/**
 * Library (B6.5 + session-19 rider): the real routes are repo-backed, so
 * component tests get this in-memory emulation (same wire shapes). Seed
 * rows via seedLibraryRow; the ingest handler stores request tags verbatim
 * — exactly the engine's meta pass-through contract.
 */
let testLibrarySources: LibrarySourceRow[] = [];
let testLibraryTranscripts: Record<string, WireSegment[]> = {};
let librarySeq = 0;

export function seedLibraryRow(
  row: Partial<LibrarySourceRow> & { uri: string },
  segments: WireSegment[] = [{ text: "seeded segment", startMs: 0, endMs: 1000 }],
): LibrarySourceRow {
  const full: LibrarySourceRow = {
    id: `test-lib-${++librarySeq}`,
    kind: "video_transcript",
    title: null,
    media: { state: "empty" },
    tags: [],
    areaRelevance: [],
    provider: "hosted-vendor",
    segmentCount: segments.length,
    createdAt: TEST_AT,
    ...row,
  };
  testLibrarySources.unshift(full);
  testLibraryTranscripts[full.id] = segments;
  return full;
}

export function resetLibraryTestState(): void {
  testLibrarySources = [];
  testLibraryTranscripts = {};
  librarySeq = 0;
}

function intelError(err: unknown): Response {
  if (err instanceof IntelStoreError) {
    return HttpResponse.json({ error: err.message }, { status: err.httpStatus });
  }
  throw err;
}

/**
 * Saved views (Phase-I window store, wired s62): in-memory emulation of the
 * /api/views upsert-by-(surface,name) contract — the board/calendar tabs'
 * tenant-wide record in tests.
 */
interface TestSavedView {
  id: string;
  surface: string;
  name: string;
  config: Record<string, unknown>;
  position: number;
}
let testSavedViews: TestSavedView[] = [];
let savedViewSeq = 0;

export function seedSavedView(view: Omit<TestSavedView, "id" | "position"> & { position?: number }): TestSavedView {
  const full: TestSavedView = { id: `test-view-${++savedViewSeq}`, position: 0, ...view };
  testSavedViews.push(full);
  return full;
}

export function listSavedViewsTestState(): TestSavedView[] {
  return testSavedViews;
}

export function resetSavedViewsTestState(): void {
  testSavedViews = [];
  savedViewSeq = 0;
}

/** Fetch-boundary mock seam for component development/tests — zero dependency on the engine/judge lanes (SPINE §5 lane map). The staged handlers wrap the SAME fake-driver store the /api/staged routes serve in dev, so tests and dev see one world. */
export const handlers = [
  /**
   * s82 C1/C2 — the publish queue's two reads, so every surface that renders
   * a draft card has a world to read from. Deliberately EMPTY and honest:
   * no queue rows, and a fit the engine would have measured. A test that
   * cares about either registers its own `server.use(...)` over these.
   *
   * These exist because the alternative is worse: `onUnhandledRequest:
   * "error"` would make every Approve-surface test emit an unhandled-request
   * error and render the card's "couldn't measure" state, which is not the
   * state those tests mean to be exercising.
   */
  http.get("/api/social/queue", () => HttpResponse.json({ rows: [] })),
  http.get("/api/social/fit", () =>
    HttpResponse.json({
      supported: true,
      bodyHash: "fixture-body-hash",
      fit: {
        platform: "linkedin",
        fits: true,
        problems: [],
        text: {
          rawChars: 42,
          billedChars: 42,
          maxChars: 3000,
          overBy: 0,
          cutIndex: 42,
          urlWeight: null,
          links: [],
          hashtags: [],
          maxHashtags: null,
          segments: [],
        },
        media: { count: 0, required: false, maxImages: 9, imageContentTypes: ["image/jpeg"] },
        capability: { verifiedOn: "2026-07-28" },
      },
      suggestedAt: "2026-07-29T09:00:00.000Z",
    }),
  ),

  // Saved views (Phase-I window): list + idempotent upsert-by-(surface,name).
  http.get("/api/views", ({ request }) => {
    const surface = new URL(request.url).searchParams.get("surface") ?? "";
    return HttpResponse.json({
      views: testSavedViews
        .filter((v) => v.surface === surface)
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    });
  }),
  http.put("/api/views", async ({ request }) => {
    const body = (await request.json()) as {
      surface: string;
      name: string;
      config?: Record<string, unknown>;
      position?: number;
    };
    const existing = testSavedViews.find((v) => v.surface === body.surface && v.name === body.name);
    if (existing) {
      existing.config = body.config ?? {};
      if (body.position !== undefined) existing.position = body.position;
      return HttpResponse.json({ view: existing });
    }
    const created = seedSavedView({
      surface: body.surface,
      name: body.name,
      config: body.config ?? {},
      position: body.position,
    });
    return HttpResponse.json({ view: created });
  }),

  // Library (B6.5): shelf read, ingest (tags stored verbatim), transcript read.
  http.get("/api/library", () =>
    HttpResponse.json({
      sources: testLibrarySources,
      seam: {
        selected: "hosted-vendor",
        registered: ["caption-file", "hosted-vendor", "whisper-local"],
        vendorConfigured: true,
      },
    }),
  ),
  http.post("/api/library/ingest", async ({ request }) => {
    const body = (await request.json()) as { url?: string; captions?: string; tags?: string[] };
    if (!body.url?.trim()) {
      return HttpResponse.json({ error: "Paste a full video URL (https://…)." }, { status: 400 });
    }
    const row = seedLibraryRow(
      { uri: body.url, tags: body.tags ?? [] },
      [
        { text: "first ingested segment", startMs: 0, endMs: 1500 },
        { text: "second ingested segment", startMs: 1500, endMs: 3000 },
      ],
    );
    return HttpResponse.json(
      { sourceId: row.id, created: true, chunkCount: 2, provider: row.provider },
      { status: 201 },
    );
  }),
  http.delete("/api/library/:sourceId", ({ params }) => {
    const sourceId = String(params.sourceId);
    const idx = testLibrarySources.findIndex((r) => r.id === sourceId);
    if (idx === -1) return HttpResponse.json({ error: "transcript not found" }, { status: 404 });
    testLibrarySources.splice(idx, 1);
    delete testLibraryTranscripts[sourceId];
    return HttpResponse.json({ deleted: true });
  }),
  http.get("/api/library/:sourceId/transcript", ({ params }) => {
    const sourceId = String(params.sourceId);
    const segments = testLibraryTranscripts[sourceId];
    const row = testLibrarySources.find((r) => r.id === sourceId);
    if (!segments || !row) {
      return HttpResponse.json({ error: "transcript not found" }, { status: 404 });
    }
    return HttpResponse.json({ sourceId, uri: row.uri, provider: row.provider, segments });
  }),

  // Shell/dashboard reads (B6.2).
  http.get("/api/app/pulse", () => HttpResponse.json(fixturePulse)),
  http.get("/api/app/activity", () => HttpResponse.json({ items: fixtureActivity })),
  http.get("/api/app/status", () => HttpResponse.json(fixtureStatus)),
  http.get("/api/app/plan", () => HttpResponse.json(fixturePlan)),

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
    HttpResponse.json({
      areas: testAreas,
      cards: listTrendCards(),
      demo: true,
      sweep: fixtureSweep,
      // The demo era has no per-source sweep stamps — the route sends [] too.
      sources: [],
    }),
  ),
  // B6.5 Sweep-now: component tests get the summary shape; the real route's engine path is route-tested.
  http.post("/api/intel/sweep", () =>
    HttpResponse.json({ source: "fake", polled: 0, cards: 0, cardsCut: 0, areasSwept: testAreas.length, sweptAt: TEST_AT, nextSweepAt: TEST_AT }),
  ),
  http.post("/api/intel/trends/:cardId/dismiss", ({ params }) => {
    try {
      return HttpResponse.json({ capture: dismissTrendCard(params.cardId as string) });
    } catch (err) {
      return intelError(err);
    }
  }),
  http.post("/api/intel/trends/:cardId/promote", async ({ params, request }) => {
    try {
      const body = (await request.json()) as {
        family: CreateFamily;
        titleIndex?: number;
        angleIndex?: number;
      };
      const { capture } = promoteTrendCard(params.cardId as string, body);
      return HttpResponse.json({
        capture,
        createHref: `/app/create?ctx=${encodeURIComponent(capture.id)}`,
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
  http.get("/api/intel/context/:captureId", ({ params }) => {
    try {
      return HttpResponse.json({ context: resolveCreateContext(params.captureId as string) });
    } catch (err) {
      return intelError(err);
    }
  }),

  // Profiles (B6.2): the real route versions through the repo; the emulation
  // keeps the same save-is-a-new-active-version semantics.
  http.get("/api/profiles", () =>
    HttpResponse.json({
      active: testProfile,
      history: testProfileHistory,
      tenant: testProfile ? { slug: "self", name: "Thalon" } : null,
    }),
  ),
  http.post("/api/profiles", async ({ request }) => {
    const body = (await request.json()) as { config?: Partial<ProfileWire["config"]> };
    if (!body.config) return HttpResponse.json({ error: "Invalid profile config" }, { status: 400 });
    const version = (testProfile?.version ?? 0) + 1;
    testProfile = {
      id: `test-profile-${version}`,
      version,
      active: true,
      config: {
        voice: body.config.voice ?? {},
        denylist: body.config.denylist ?? [],
        platformProfiles: body.config.platformProfiles ?? {},
        identity: body.config.identity ?? {},
      },
      createdAt: TEST_AT,
    };
    testProfileHistory = [
      { profileId: testProfile.id, version, activatedOnCreate: true, at: TEST_AT },
      ...testProfileHistory,
    ];
    return HttpResponse.json({ profile: testProfile }, { status: 201 });
  }),
  http.post("/api/intel/search/target-this", async ({ request }) => {
    const body = (await request.json()) as { query: string; family?: CreateFamily };
    const { capture } = targetSearchQuery(body.query, body.family);
    return HttpResponse.json({
      capture,
      createHref: `/app/create?ctx=${encodeURIComponent(capture.id)}`,
    });
  }),

  // The staged fixture run rides last (oldest) so the classic fixtures keep auto-selecting first.
  http.get("/api/runs", () => HttpResponse.json({ runs: [...fixtureRuns, getStagedRunForFeed()] })),

  // The board state's two other reads — deliberately empty and honest (the
  // s82 C1/C2 pattern above): a test that cares registers its own.
  http.get("/api/create/runs", () => HttpResponse.json({ runs: [], usageToday: null })),
  http.get("/api/intel/picks", () => HttpResponse.json({ picks: [] })),

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
