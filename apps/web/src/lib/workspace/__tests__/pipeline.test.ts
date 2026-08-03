import { describe, expect, it } from "vitest";
import { assetStages, kanbanColumns } from "../pipeline";
import type { PipelineAsset } from "../types";

function asset(overrides: Partial<PipelineAsset> & { draftId: string }): PipelineAsset {
  return {
    runId: "run-1",
    platform: "linkedin",
    format: null,
    status: "queued",
    sourceKind: "url",
    capturedAt: "2026-07-14T08:00:00.000Z",
    generatedAt: "2026-07-14T09:00:00.000Z",
    judgedAt: "2026-07-14T09:05:00.000Z",
    decidedAt: null,
    publishedAt: null,
    gates: [{ gate: "g1", verdict: "pass" }],
    reasons: [],
    deployRef: null,
    excerpt: "fixture excerpt",
    media: null,
    ...overrides,
  };
}

describe("assetStages", () => {
  it("marks the operator's stage as attention: decided on a queued draft, judged on a blocked one", () => {
    const queued = assetStages(asset({ draftId: "q" }));
    expect(queued.find((s) => s.key === "decided")).toMatchObject({
      state: "attention",
      detail: "waits on you",
      href: "/app/approve?run=run-1&draft=q",
    });
    expect(queued.find((s) => s.key === "judged")?.state).toBe("done");

    const blocked = assetStages(
      asset({ draftId: "b", status: "blocked", reasons: ["Denylist: matched a term"] }),
    );
    expect(blocked.find((s) => s.key === "judged")).toMatchObject({
      state: "attention",
      detail: "Denylist: matched a term",
    });
  });

  it("every reached stage opens its artifact; unreached stages carry no link and read pending", () => {
    const stages = assetStages(asset({ draftId: "q" }));
    expect(stages.find((s) => s.key === "captured")?.href).toBe("/app/library");
    expect(stages.find((s) => s.key === "generated")?.href).toBe("/app/runs?run=run-1");
    expect(stages.find((s) => s.key === "published")).toMatchObject({
      state: "pending",
      href: null,
      at: null,
    });
  });

  it("a published page's last stage links to the live URL", () => {
    const stages = assetStages(
      asset({
        draftId: "p",
        status: "approved",
        format: "web_page",
        decidedAt: "2026-07-14T10:00:00.000Z",
        publishedAt: "2026-07-14T10:01:00.000Z",
        deployRef: "/blog/my-post",
      }),
    );
    expect(stages.find((s) => s.key === "published")).toMatchObject({
      state: "done",
      href: "/blog/my-post",
      detail: "live on site",
    });
  });

  it("a draft with no captured source renders that stage honestly unreached, never fabricated", () => {
    const stages = assetStages(asset({ draftId: "x", capturedAt: null, sourceKind: null }));
    expect(stages.find((s) => s.key === "captured")).toMatchObject({
      state: "pending",
      href: null,
    });
  });
});

describe("kanbanColumns", () => {
  it("groups by station, flags operator columns, and demotes rejected to a count", () => {
    const { columns, rejected } = kanbanColumns([
      asset({ draftId: "g", status: "generated" }),
      asset({ draftId: "j", status: "judging" }),
      asset({ draftId: "b", status: "blocked" }),
      asset({ draftId: "q", status: "queued" }),
      asset({ draftId: "a", status: "approved" }),
      asset({ draftId: "p", status: "published" }),
      asset({ draftId: "r", status: "rejected" }),
    ]);
    expect(columns.map((c) => [c.key, c.assets.length, c.needsYou])).toEqual([
      ["drafting", 2, false],
      ["blocked", 1, true],
      ["queued", 1, true],
      ["done", 2, false],
    ]);
    expect(rejected).toBe(1);
  });
});
