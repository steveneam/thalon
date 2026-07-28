import { describe, expect, it, vi } from "vitest";
import type { TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { prepareCutPreview, RenderRefusedError } from "../render";

/**
 * THE WORKING-COPY PREVIEW's three deliberate differences from a render
 * (lib/videos/render.ts). Each is a thing that would be a defect if it drifted
 * back, so each is pinned here rather than left to the comment beside it.
 */

const CTX = { tenantId: "t1" } as unknown as TenantCtx;

const WORKING_EDL = {
  name: "mini",
  output: { width: 1280, height: 720, fps: 24, duration: 9.5 },
  video: [
    { name: "b1", source: { kind: "take", ref: "motion/keepers/beat-01.mp4" }, duration: 5 },
    {
      name: "b2",
      source: { kind: "take", ref: "motion/keepers/beat-02.mp4" },
      duration: 5,
      transitionIn: { type: "xfade", duration: 0.5 },
    },
  ],
};

function repos(cutStatus: string, meta: Record<string, unknown> = { mediaRoot: "/media/p1" }) {
  const recordRender = vi.fn();
  return {
    recordRender,
    repos: {
      videoProjects: { get: vi.fn().mockResolvedValue({ id: "p1", meta }) },
      videoCuts: {
        get: vi.fn().mockResolvedValue({
          id: "c1",
          projectId: "p1",
          name: "film",
          version: 6,
          status: cutStatus,
          edl: WORKING_EDL,
        }),
        recordRender,
      },
    } as unknown as Repos,
  };
}

describe("prepareCutPreview", () => {
  it("renders the EDL it is GIVEN, not the one on the row", async () => {
    // The whole point: the working copy exists only in the browser until Save.
    const { repos: r } = repos("draft");
    const edited = {
      ...WORKING_EDL,
      video: [WORKING_EDL.video[0]],
      output: { ...WORKING_EDL.output, duration: 5 },
    };
    const prepared = await prepareCutPreview(r, CTX, "p1", "c1", edited);
    expect(prepared.plan.inputs).toHaveLength(1);
  });

  it("does NOT refuse a rendered or approved cut — that is exactly when preview is wanted", async () => {
    // prepareCutRender refuses these because a stored EDL is immutable. A
    // preview renders the UNSAVED next version, and on real projects every cut
    // is already rendered or approved, so the draft-only rule would make the
    // verb unusable everywhere it matters.
    for (const status of ["rendered", "approved"]) {
      const { repos: r } = repos(status);
      await expect(prepareCutPreview(r, CTX, "p1", "c1", WORKING_EDL)).resolves.toMatchObject({
        cutId: "c1",
      });
    }
  });

  it("writes to an overwritable per-cut preview file, never a version filename", async () => {
    const { repos: r } = repos("rendered");
    const prepared = await prepareCutPreview(r, CTX, "p1", "c1", WORKING_EDL);
    expect(prepared.outputRef).toBe("cuts/previews/c1.mp4");
    // A version filename would collide with the render door's own output and
    // let a preview masquerade as the rendered version of the cut.
    expect(prepared.outputRef).not.toMatch(/-v\d+\.mp4$/);
  });

  it("refuses an EDL that does not compile, 422, before any ffmpeg runs", async () => {
    const { repos: r } = repos("draft");
    const twoCues = {
      ...WORKING_EDL,
      audio: [
        { source: { kind: "audio", ref: "music/a.mp3" } },
        { source: { kind: "audio", ref: "music/b.mp3" } },
      ],
    };
    await expect(prepareCutPreview(r, CTX, "p1", "c1", twoCues)).rejects.toMatchObject({
      status: 422,
    });
  });

  it("refuses a client EDL at the contract boundary — shape is never trusted", async () => {
    const { repos: r } = repos("draft");
    await expect(
      prepareCutPreview(r, CTX, "p1", "c1", { video: [{ source: { kind: "take", ref: "../etc/passwd" } }] }),
    ).rejects.toBeInstanceOf(RenderRefusedError);
  });

  it("refuses a project with no media root, 422", async () => {
    const { repos: r } = repos("draft", {});
    await expect(prepareCutPreview(r, CTX, "p1", "c1", WORKING_EDL)).rejects.toMatchObject({
      status: 422,
    });
  });

  it("never records a render — an unsaved EDL leaves no provenance", async () => {
    const { repos: r, recordRender } = repos("draft");
    await prepareCutPreview(r, CTX, "p1", "c1", WORKING_EDL);
    expect(recordRender).not.toHaveBeenCalled();
  });
});
