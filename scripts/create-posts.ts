/**
 * Pre-surface post fan-out CLI — the B1.2→B1.3 loop from the shell: ingest
 * a prompt brief as a source, fan out platform-native drafts, judge each
 * through the real pipeline (same wiring as the workspace). Drafts land
 * queued (judge-passed, awaiting approval) or blocked — NOTHING publishes.
 *
 * Usage:
 *   CREATE_TENANT_ID=<uuid> \
 *   CREATE_PROMPT_FILE=path/to/brief.md \
 *   CREATE_PLATFORMS=linkedin,x,facebook \
 *   CREATE_TARGET_TERMS="AI,AI harness" \   # optional discoverability candidates (Phase 2c)
 *   npx tsx scripts/create-posts.ts
 *
 * Requires DATABASE_URL + gateway env (source apps/web/.env.local).
 */
import { readFileSync } from "node:fs";
import { socialPlatformSchema, tenantCtx } from "@thalon/contracts";
import { openDb, sha256Hex } from "@thalon/db";
import { runFanout } from "@thalon/engine";
import { gatewayJudgeDriver, runJudgePipeline } from "@thalon/judge";
import { readEnv } from "@thalon/platform";

async function main(): Promise<void> {
  const tenantId = process.env.CREATE_TENANT_ID;
  const promptFile = process.env.CREATE_PROMPT_FILE;
  const platforms = (process.env.CREATE_PLATFORMS ?? "")
    .split(",")
    .map((p) => socialPlatformSchema.parse(p.trim()));
  if (!tenantId || !promptFile || platforms.length === 0) {
    throw new Error("CREATE_TENANT_ID, CREATE_PROMPT_FILE and CREATE_PLATFORMS are required");
  }
  const brief = readFileSync(promptFile, "utf8");
  const handle = await openDb();
  try {
    const ctx = tenantCtx(tenantId);
    const { repos } = handle;
    const { source } = await repos.sourceChunks.ingest(ctx, {
      kind: "prompt",
      contentHash: sha256Hex(brief),
      chunks: [
        {
          seq: 0,
          text: brief,
          tokenCount: Math.ceil(brief.length / 4),
          contentHash: sha256Hex(`0:${brief}`),
        },
      ],
    });
    console.log(`source: ${source.id}`);

    const exemplarK = process.env.CREATE_EXEMPLAR_K ? Number(process.env.CREATE_EXEMPLAR_K) : undefined;
    // Phase 2c: optional comma-separated discoverability candidates (e.g. the
    // monitored area's intel keywords) — folded into each draft's declared
    // meta.targetTerms after the brief's canonical entities.
    const targetTerms = (process.env.CREATE_TARGET_TERMS ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const result = await runFanout(ctx, repos, {
      sourceId: source.id,
      platforms,
      ...(exemplarK ? { exemplar: { k: exemplarK } } : {}),
      ...(targetTerms.length > 0 ? { targetTerms } : {}),
    });
    console.log(`run: ${result.runId} (created: ${result.created})`);

    const capTokens = readEnv().TENANT_DAILY_TOKEN_BUDGET;
    for (const draft of result.drafts) {
      const current = await repos.drafts.get(ctx, draft.id);
      if (current.status === "generated") {
        await repos.drafts.transition(ctx, draft.id, "judging");
        await runJudgePipeline(repos, {
          ctx,
          draftId: draft.id,
          screenDriver: gatewayJudgeDriver(),
          finalDriver: gatewayJudgeDriver(),
          capTokens,
        });
      }
      const judged = await repos.drafts.get(ctx, draft.id);
      console.log(`\n=== ${judged.platform} [${judged.status}] draft ${judged.id} ===`);
      console.log(judged.body);
    }
  } finally {
    await handle.close();
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exitCode = 1;
});
