import { http, HttpResponse } from "msw";
import { fixtureDraftDetails, fixtureDraftsByRun, fixtureRuns } from "@/lib/approve-queue/fixtures";

/** Fetch-boundary mock seam for component development/tests — zero dependency on the engine/judge lanes (SPINE §5 lane map). */
export const handlers = [
  http.get("/api/runs", () => HttpResponse.json({ runs: fixtureRuns })),

  http.get("/api/runs/:runId/drafts", ({ params }) => {
    const drafts = fixtureDraftsByRun[params.runId as string] ?? [];
    return HttpResponse.json({ drafts });
  }),

  http.get("/api/drafts/:draftId", ({ params }) => {
    const detail = fixtureDraftDetails[params.draftId as string];
    if (!detail) return HttpResponse.json({ error: "not found" }, { status: 404 });
    return HttpResponse.json(detail);
  }),
];
