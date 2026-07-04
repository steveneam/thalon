export interface WebPageDeployRequest {
  tenantId: string;
  title: string;
  /** The exact judged artifact bytes, fetched from the content-addressed store. */
  html: string;
  /** Content-addressed object-store key the html was fetched from (`web-pages/<sha256>.html`) — provenance for the target. */
  htmlRef: string;
}

export interface WebPageDeployOutcome {
  /** Where the page now lives: the target-reported URL (a real deploy) or a stable preview ref (a preview-only target). */
  url: string;
}

/**
 * B3.15 ship seam (CHARTER B3.15; thin in pass 1 per amendment A9). A
 * deploy target puts ONE self-contained page somewhere reachable and NEVER
 * persists anything in Thalon — only ./deploy.ts, the core caller, writes
 * to the draft (SPINE §1, same read-only driver contract as the B3.10
 * RenderTarget). The real Vercel adapter lands behind this interface in
 * pass 2 (the natural target — the tenants already live there);
 * ./fake-deploy-target.ts is the deterministic keyless test double. No
 * social publish path is wired anywhere in Sprint 3 — this seam ships a
 * web artifact the operator already approved, and only ever on an explicit
 * post-approval call.
 */
export interface DeployTarget {
  readonly name: string;
  deploy(request: WebPageDeployRequest): Promise<WebPageDeployOutcome>;
}
