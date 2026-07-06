import { http, HttpResponse } from "msw";
import { fixtureDraftDetails, fixtureDraftsByRun, fixtureRuns } from "@/lib/approve-queue/fixtures";
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

/** Fetch-boundary mock seam for component development/tests — zero dependency on the engine/judge lanes (SPINE §5 lane map). The staged handlers wrap the SAME fake-driver store the /api/staged routes serve in dev, so tests and dev see one world. */
export const handlers = [
  // Shell/dashboard reads (B6.2).
  http.get("/api/app/pulse", () => HttpResponse.json(fixturePulse)),
  http.get("/api/app/activity", () => HttpResponse.json({ items: fixtureActivity })),
  http.get("/api/app/status", () => HttpResponse.json(fixtureStatus)),

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
