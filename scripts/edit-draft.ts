/**
 * Pre-surface operator edit — the workspace edit door from the shell:
 * records the edit through approvals (edit_diffs + eval_cases land in the
 * SAME transaction — the dogfood discipline is structural), then re-judges
 * in the same run, exactly like apps/web's editDraft action.
 *
 * Usage:
 *   EDIT_TENANT_ID=<uuid> EDIT_DRAFT_ID=<uuid> EDIT_BODY_FILE=path \
 *   npx tsx scripts/edit-draft.ts
 */
import { readFileSync } from "node:fs";
import { tenantCtx } from "@thalon/contracts";
import { openDb } from "@thalon/db";
import { gatewayJudgeDriver, runJudgePipeline } from "@thalon/judge";
import { readEnv } from "@thalon/platform";

async function main(): Promise<void> {
  const tenantId = process.env.EDIT_TENANT_ID;
  const draftId = process.env.EDIT_DRAFT_ID;
  const bodyFile = process.env.EDIT_BODY_FILE;
  if (!tenantId || !draftId || !bodyFile) {
    throw new Error("EDIT_TENANT_ID, EDIT_DRAFT_ID and EDIT_BODY_FILE are required");
  }
  const editedBody = readFileSync(bodyFile, "utf8").trim();
  const handle = await openDb();
  try {
    const ctx = tenantCtx(tenantId);
    const { repos } = handle;
    await repos.approvals.record(ctx, {
      draftId,
      actor: "operator",
      action: "edit",
      editedBody,
    });
    await runJudgePipeline(repos, {
      ctx,
      draftId,
      screenDriver: gatewayJudgeDriver(),
      finalDriver: gatewayJudgeDriver(),
      capTokens: readEnv().TENANT_DAILY_TOKEN_BUDGET,
    });
    const judged = await repos.drafts.get(ctx, draftId);
    console.log(`=== ${judged.platform} [${judged.status}] draft ${judged.id} ===`);
    console.log(judged.body);
  } finally {
    await handle.close();
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exitCode = 1;
});
