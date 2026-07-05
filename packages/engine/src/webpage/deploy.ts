import type { TenantCtx } from "@thalon/contracts";
import { ArtifactMissingError, type Draft, type Repos } from "@thalon/db";
import { getObjectStore, type ObjectStore } from "@thalon/platform";
import { runArtifactStage } from "../pipeline/artifact-stage";
import type { DeployTarget } from "./deploy-target";
import { webPageDraftMetaSchema, type WebPageDraftMeta } from "./schemas";

export interface DeployWebPageDeps {
  objectStore?: ObjectStore;
}

export type DeployWebPageResult =
  | { status: "deployed"; draft: Draft; url: string }
  | { status: "failed"; draft: Draft; error: string };

/**
 * B3.15 ship entry point (thin pass-1 cut per amendment A9): puts an
 * `approved` `web_page` draft's content-addressed artifact through a
 * `DeployTarget`. The approved-only gate, meta parse, and
 * optimistic-concurrency outcome patch live in the shared artifact stage
 * (../pipeline/artifact-stage.ts, B4.1). The deployed bytes are fetched
 * from the store by the exact `htmlRef` the judge-bound body was derived
 * from — what ships IS what was judged, structurally.
 *
 * A target failure lands `deployStatus: "failed"` + `deployRef: null` on
 * the draft (overwriting any prior success — the meta must reflect the
 * LATEST deploy's truth). A missing artifact is an invariant break (the
 * generation path always writes it first) and throws rather than recording
 * a "failed" deploy.
 */
export async function deployWebPage(
  ctx: TenantCtx,
  repos: Repos,
  draftId: string,
  target: DeployTarget,
  deps: DeployWebPageDeps = {},
): Promise<DeployWebPageResult> {
  const objectStore = deps.objectStore ?? getObjectStore();

  return runArtifactStage<WebPageDraftMeta, DeployWebPageResult>(ctx, repos, draftId, {
    format: {
      expected: "web_page",
      mismatchMessage: (draft) =>
        `draft "${draftId}" is format "${draft.format}" — the web deploy seam ships ONLY "web_page" drafts`,
    },
    notApprovedMessage: (draft) =>
      `draft "${draftId}" is status "${draft.status}" — web deploy runs ONLY on an "approved" draft`,
    parseMeta: (meta) => webPageDraftMetaSchema.parse(meta),
    execute: async (_draft, meta) => {
      const htmlBytes = await objectStore.get(meta.htmlRef);
      if (!htmlBytes) {
        throw new ArtifactMissingError(
          meta.htmlRef,
          `web_page artifact "${meta.htmlRef}" is missing from the object store — the generation path always persists it before the draft exists; refusing to deploy`,
        );
      }

      let url: string;
      try {
        ({ url } = await target.deploy({
          tenantId: ctx.tenantId,
          title: meta.title,
          html: htmlBytes.toString("utf8"),
          htmlRef: meta.htmlRef,
        }));
      } catch (err) {
        return {
          patch: { deployStatus: "failed", deployRef: null },
          finish: (updated: Draft) => ({
            status: "failed" as const,
            draft: updated,
            error: `deploy target "${target.name}" failed: ${err instanceof Error ? err.message : String(err)}`,
          }),
        };
      }

      return {
        patch: { deployStatus: "deployed", deployRef: url },
        finish: (updated: Draft) => ({ status: "deployed" as const, draft: updated, url }),
      };
    },
  });
}
