import { brandIdentitySchema, type TenantCtx } from "@thalon/contracts";
import { sha256Hex, stableStringify, type Draft, type Repos } from "@thalon/db";
import { getObjectStore, type ObjectStore } from "@thalon/platform";
import { pillarScriptDraftMetaSchema } from "../origination/schemas";
import { derivePillarTimeline, renderSrt } from "./srt";
import type { PillarRenderManifest, RenderTarget } from "./target";

export interface RenderPillarDeps {
  objectStore?: ObjectStore;
  /** Reads the target's rendered video file (the fake target returns `videoPath: null`, so tests never exercise this). Overridable so ./render.ts stays filesystem-free in tests. */
  readVideo?: (videoPath: string) => Promise<Buffer>;
}

export type RenderPillarResult =
  | {
      status: "rendered";
      draft: Draft;
      /** Object-store key of the content-addressed manifest; sibling artifacts (captions.srt, artifacts.json, video.mp4 when present) live under the same `renders/pillar/<hash>/` prefix. */
      renderRef: string;
      srt: string;
      /** true when the manifest already existed in the store — the target was never invoked (content-addressed render cache, CHARTER B3.10). */
      cached: boolean;
    }
  | { status: "failed"; draft: Draft; error: string };

async function defaultReadVideo(videoPath: string): Promise<Buffer> {
  const { readFile } = await import("node:fs/promises");
  return readFile(videoPath);
}

/**
 * B3.10 entry point (CHARTER B3.10; thin pass-1 cut per amendment A9):
 * renders an `approved` `pillar_script` draft through a `RenderTarget` into
 * content-addressed artifacts — the deterministic SRT (from the authored
 * beats, ./srt.ts) + the render manifest (+ the video file once a real
 * target produces one). Runs ONLY against an `approved` draft — asserted up
 * front (post-approval-only work, never speculative render spend; same gate
 * as B2.5's capture).
 *
 * Content-addressed render cache: the cache key is the sha256 of the
 * manifest itself (script timeline + render-time brand styling), so an
 * identical script under an identical brand never re-renders, and any brand
 * or script change re-keys automatically. `manifest.json` is written LAST —
 * it is the cache's commit marker; a crash mid-write leaves no
 * half-trusted cache entry.
 *
 * A target failure lands `renderStatus: "failed"` + `renderRef: null` on
 * the draft (overwriting any prior success — the meta must reflect the
 * LATEST render's truth, mirroring capture.ts), via the same
 * optimistic-concurrency `updateMeta` guard: a concurrent render of the
 * same draft loses as a loud `ConcurrentUpdateError`, never a silent
 * clobber.
 */
export async function renderPillar(
  ctx: TenantCtx,
  repos: Repos,
  draftId: string,
  target: RenderTarget,
  deps: RenderPillarDeps = {},
): Promise<RenderPillarResult> {
  const draft = await repos.drafts.get(ctx, draftId);
  if (draft.format !== "pillar_script") {
    throw new Error(
      `draft "${draftId}" is format "${draft.format}" — the pillar render seam renders ONLY "pillar_script" drafts`,
    );
  }
  if (draft.status !== "approved") {
    throw new Error(
      `draft "${draftId}" is status "${draft.status}" — pillar render runs ONLY on an "approved" draft`,
    );
  }
  const meta = pillarScriptDraftMetaSchema.parse(draft.meta);
  const expectedUpdatedAt = draft.updatedAt;
  const objectStore = deps.objectStore ?? getObjectStore();
  const readVideo = deps.readVideo ?? defaultReadVideo;

  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) {
    throw new Error(
      `tenant ${ctx.tenantId} has no active brand profile — the composition's brand styling comes from the active profile`,
    );
  }

  const timeline = derivePillarTimeline(meta);
  const srt = renderSrt(timeline);
  const manifest: PillarRenderManifest = {
    manifestVersion: "pillar-render.v1",
    tenantId: ctx.tenantId,
    title: meta.title,
    timeline,
    brand: {
      profileId: profile.id,
      profileVersion: profile.version,
      identity: brandIdentitySchema.parse(profile.identity ?? {}),
      voice: (profile.voice as Record<string, unknown> | null) ?? {},
    },
    script: {
      promptVersion: meta.promptVersion,
      brandProfileVersion: meta.brandProfileVersion,
      platformProfileVersion: meta.platformProfileVersion,
    },
  };
  const manifestJson = stableStringify(manifest);
  const prefix = `renders/pillar/${sha256Hex(manifestJson)}`;
  const manifestKey = `${prefix}/manifest.json`;

  // Cache hit: an identical manifest was fully rendered before — reuse its
  // artifacts, never invoke the target. The meta patch still lands so a
  // re-render after e.g. a prior failure truthfully records this success.
  const cachedManifest = await objectStore.get(manifestKey);
  if (cachedManifest) {
    const updated = await repos.drafts.updateMeta(ctx, draftId, expectedUpdatedAt, {
      renderStatus: "rendered",
      renderRef: manifestKey,
    });
    return { status: "rendered", draft: updated, renderRef: manifestKey, srt, cached: true };
  }

  let videoPath: string | null;
  try {
    ({ videoPath } = await target.render({ manifest, srt }));
  } catch (err) {
    const updated = await repos.drafts.updateMeta(ctx, draftId, expectedUpdatedAt, {
      renderStatus: "failed",
      renderRef: null,
    });
    return {
      status: "failed",
      draft: updated,
      error: `render target "${target.name}" failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  await objectStore.put(`${prefix}/captions.srt`, srt);
  if (videoPath) await objectStore.put(`${prefix}/video.mp4`, await readVideo(videoPath));
  await objectStore.put(
    `${prefix}/artifacts.json`,
    stableStringify({ captions: "captions.srt", video: videoPath ? "video.mp4" : null, target: target.name }),
  );
  // Written last: manifest.json is the cache commit marker, and its bytes
  // ARE the hashed content (sha256(manifest.json) === the prefix hash — the
  // content-addressing is independently verifiable).
  await objectStore.put(manifestKey, manifestJson);

  const updated = await repos.drafts.updateMeta(ctx, draftId, expectedUpdatedAt, {
    renderStatus: "rendered",
    renderRef: manifestKey,
  });
  return { status: "rendered", draft: updated, renderRef: manifestKey, srt, cached: false };
}
