import type { PillarRenderArtifacts, PillarRenderRequest, RenderTarget } from "./target";

export interface FakeRenderTargetDeps {
  /** When set, every render() call throws with this message — lets tests exercise the "failed" path deterministically. */
  failWith?: string;
}

export interface FakeRenderTarget extends RenderTarget {
  /** Every request this fake received, in call order — lets tests assert the cache short-circuits repeat renders. */
  readonly requests: PillarRenderRequest[];
}

/**
 * Deterministic test double for the B3.10 render seam: no Remotion, no
 * ffmpeg, no filesystem — keeps every render test keyless (amendment A9
 * pass-1 discipline). Returns `videoPath: null` (a render can legitimately
 * produce no video yet — the manifest + SRT are still the artifacts); the
 * real Remotion target replaces it behind the same interface in pass 2.
 */
export function createFakeRenderTarget(deps: FakeRenderTargetDeps = {}): FakeRenderTarget {
  const requests: PillarRenderRequest[] = [];
  return {
    name: "fake",
    requests,
    async render(request): Promise<PillarRenderArtifacts> {
      requests.push(request);
      if (deps.failWith) throw new Error(deps.failWith);
      return { videoPath: null };
    },
  };
}
