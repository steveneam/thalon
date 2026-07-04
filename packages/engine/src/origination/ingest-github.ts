import type { TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { ingestSource, type IngestDeps, type IngestResult } from "../ingest";
import { getFetcher } from "../ingest/fetcher";

/**
 * B3.9: pull a public repository's README through GitHub's OFFICIAL REST API
 * (no key needed for public repos; anonymous quota is plenty for one-shot
 * ingest) and land it as a `doc` source the origination step can ground on.
 * The plain JSON endpoint is used deliberately — it works through the
 * existing Fetcher seam with no custom headers; the README text arrives
 * base64-encoded in `content`.
 */
export interface GithubIngestRequest {
  /** "owner/name" of a PUBLIC repository. */
  repo: string;
}

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export async function ingestGithubReadme(
  ctx: TenantCtx,
  repos: Repos,
  request: GithubIngestRequest,
  deps: IngestDeps = {},
): Promise<IngestResult> {
  if (!REPO_PATTERN.test(request.repo)) {
    throw new Error(`invalid GitHub repo "${request.repo}" — expected "owner/name"`);
  }
  const fetcher = deps.fetcher ?? getFetcher();
  const url = `https://api.github.com/repos/${request.repo}/readme`;
  const page = await fetcher.fetch(url);

  let payload: unknown;
  try {
    payload = JSON.parse(page.html);
  } catch {
    throw new Error(`GitHub readme endpoint for "${request.repo}" returned non-JSON`);
  }
  const content = (payload as { content?: unknown; encoding?: unknown }) ?? {};
  if (typeof content.content !== "string" || content.encoding !== "base64") {
    throw new Error(
      `GitHub readme endpoint for "${request.repo}" returned an unexpected shape (no base64 content) — private repo or API change?`,
    );
  }
  const text = Buffer.from(content.content, "base64").toString("utf8").trim();
  if (!text) throw new Error(`README for "${request.repo}" is empty — nothing to ingest`);

  return ingestSource(
    ctx,
    repos,
    { kind: "doc", doc: text, meta: { origin: "github_readme", repo: request.repo } },
    deps,
  );
}
