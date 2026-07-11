import type { PillarTimeline } from "./srt";

/**
 * The render manifest — the complete, self-contained composition spec a
 * `RenderTarget` renders from (and the content-address of a render: its
 * stableStringify bytes are what ./render.ts hashes into the cache key).
 * Brand styling comes from the tenant's CURRENT active profile at render
 * time — the video reflects the brand as it is now, mirroring how the judge
 * grounds against the ACTIVE identity — while `script.brandProfileVersion`
 * keeps the generation-time provenance. Data, never code: nothing in here
 * is a hard-coded brand fact.
 */
export interface PillarRenderManifest {
  manifestVersion: "pillar-render.v1";
  tenantId: string;
  title: string;
  timeline: PillarTimeline;
  brand: {
    profileId: string;
    /** Render-time ACTIVE profile version (styling source). */
    profileVersion: number;
    identity: Record<string, unknown>;
    voice: Record<string, unknown>;
  };
  script: {
    promptVersion: string;
    /** Generation-time profile version, from the draft's pinned meta. */
    brandProfileVersion: number;
    platformProfileVersion: string;
  };
}

export interface PillarRenderRequest {
  manifest: PillarRenderManifest;
  /** The deterministic SRT derived from the same timeline — burned/side-loaded per the target's capability. */
  srt: string;
}

export interface PillarRenderArtifacts {
  /** Absolute path to the rendered video file, or null when the target renders no video (the fake target; a preview-only target). */
  videoPath: string | null;
  /**
   * Releases the target's throwaway work dir — `videoPath` may live inside
   * it, so only the core caller (./render.ts) invokes this, after the video
   * bytes are persisted. Best-effort and idempotent; a target that leaves
   * nothing on disk omits it.
   */
  cleanup?: () => Promise<void>;
}

/**
 * B3.10 render seam (CHARTER B3.10; thin in pass 1 per amendment A9). A
 * render target turns one manifest into video artifacts and NEVER persists
 * anything — only ./render.ts, the core caller, writes to the object store
 * or the draft (SPINE §1, same read-only driver contract as B2.5's
 * `DemoDriver`). The real Remotion composition lands behind this interface
 * in pass 2 (licence = growth gate, ADR 0003 §3; swap path lives here);
 * ./fake-target.ts is the deterministic keyless test double.
 */
export interface RenderTarget {
  readonly name: string;
  render(request: PillarRenderRequest): Promise<PillarRenderArtifacts>;
}
