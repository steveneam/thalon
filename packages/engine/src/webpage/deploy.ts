import type { TenantCtx } from "@thalon/contracts";
import type { Draft, Repos } from "@thalon/db";
import { getObjectStore, type ObjectStore } from "@thalon/platform";
import type { DeployTarget } from "./deploy-target";
import { webPageDraftMetaSchema } from "./schemas";

export interface DeployWebPageDeps {
  objectStore?: ObjectStore;
}

export type DeployWebPageResult =
  | { status: "deployed"; draft: Draft; url: string }
  | { status: "failed"; draft: Draft; error: string };

/**
 * B3.15 ship entry point (thin pass-1 cut per amendment A9): puts an
 * `approved` `web_page` draft's content-addressed artifact through a
 * `DeployTarget`. Runs ONLY against an `approved` draft — asserted up front
 * (post-approval-only work, same gate as B3.10's render and B2.5's
 * capture). The deployed bytes are fetched from the store by the exact
 * `htmlRef` the judge-bound body was derived from — what ships IS what was
 * judged, structurally.
 *
 * A target failure lands `deployStatus: "failed"` + `deployRef: null` on
 * the draft (overwriting any prior success — the meta must reflect the
 * LATEST deploy's truth), via the optimistic-concurrency `updateMeta`
 * guard: a concurrent deploy of the same draft loses as a loud
 * `ConcurrentUpdateError`, never a silent clobber. A missing artifact is an
 * invariant break (the generation path always writes it first) and throws
 * rather than recording a "failed" deploy.
 */
export async function deployWebPage(
  ctx: TenantCtx,
  repos: Repos,
  draftId: string,
  target: DeployTarget,
  deps: DeployWebPageDeps = {},
): Promise<DeployWebPageResult> {
  const draft = await repos.drafts.get(ctx, draftId);
  if (draft.format !== "web_page") {
    throw new Error(
      `draft "${draftId}" is format "${draft.format}" — the web deploy seam ships ONLY "web_page" drafts`,
    );
  }
  if (draft.status !== "approved") {
    throw new Error(
      `draft "${draftId}" is status "${draft.status}" — web deploy runs ONLY on an "approved" draft`,
    );
  }
  const meta = webPageDraftMetaSchema.parse(draft.meta);
  const expectedUpdatedAt = draft.updatedAt;
  const objectStore = deps.objectStore ?? getObjectStore();

  const htmlBytes = await objectStore.get(meta.htmlRef);
  if (!htmlBytes) {
    throw new Error(
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
    const updated = await repos.drafts.updateMeta(ctx, draftId, expectedUpdatedAt, {
      deployStatus: "failed",
      deployRef: null,
    });
    return {
      status: "failed",
      draft: updated,
      error: `deploy target "${target.name}" failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const updated = await repos.drafts.updateMeta(ctx, draftId, expectedUpdatedAt, {
    deployStatus: "deployed",
    deployRef: url,
  });
  return { status: "deployed", draft: updated, url };
}
