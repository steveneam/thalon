import type { DeployTarget, WebPageDeployRequest } from "./deploy-target";

export interface FakeDeployTargetDeps {
  /** When set, every deploy() call throws with this message — lets tests exercise the "failed" path deterministically. */
  failWith?: string;
}

export interface FakeDeployTarget extends DeployTarget {
  /** Every request this fake received, in call order. */
  readonly requests: WebPageDeployRequest[];
}

/**
 * Deterministic test double for the B3.15 deploy seam: no network, no
 * Vercel, no credentials — keeps every deploy test keyless (amendment A9
 * pass-1 discipline). The reported URL is a stable `preview://` ref derived
 * from the content-addressed htmlRef, so identical content "deploys" to an
 * identical address.
 */
export function createFakeDeployTarget(deps: FakeDeployTargetDeps = {}): FakeDeployTarget {
  const requests: WebPageDeployRequest[] = [];
  return {
    name: "fake",
    requests,
    async deploy(request) {
      requests.push(request);
      if (deps.failWith) throw new Error(deps.failWith);
      return { url: `preview://${request.htmlRef}` };
    },
  };
}
