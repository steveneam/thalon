import type { TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import {
  runOnePromptVideo,
  type IngestDeps,
  type OnePromptJudgeDeps,
  type StagedVideoDeps,
} from "@thalon/engine";
import { gatewayJudgeDriver } from "@thalon/judge";
import { readEnv } from "@thalon/platform";
import type { OnePromptVideoRequest, OnePromptVideoWire } from "./one-prompt-types";

/**
 * The one-prompt video door's service half (B-vid.7): the Create brief →
 * `runOnePromptVideo` (engine) — ingest, staged drafts judged between
 * stages, project + takes plan + draft cut — wired with the SAME judge
 * defaults as every other judged door (the judge-runner wiring: gateway
 * driver both tiers, tenant daily token budget). Deps injectable so tests
 * stay keyless (the compose-email pattern); no render target is wired
 * anywhere on this path — rendering stays behind the existing armed doors.
 */

export interface OnePromptVideoServiceDeps {
  judge?: OnePromptJudgeDeps;
  staged?: StagedVideoDeps;
  ingest?: IngestDeps;
  /** Test-only clock override; production stamps the real time. */
  now?: () => Date;
}

export async function generateOnePromptVideo(
  ctx: TenantCtx,
  repos: Repos,
  input: OnePromptVideoRequest,
  deps: OnePromptVideoServiceDeps = {},
): Promise<OnePromptVideoWire> {
  const result = await runOnePromptVideo(
    {
      ctx,
      repos,
      judge: deps.judge ?? {
        screenDriver: gatewayJudgeDriver(),
        finalDriver: gatewayJudgeDriver(),
        capTokens: readEnv().TENANT_DAILY_TOKEN_BUDGET,
      },
      staged: deps.staged,
      ingest: deps.ingest,
    },
    { prompt: input.prompt, sourceUrl: input.sourceUrl },
    deps.now?.() ?? new Date(),
  );
  const stageKeys = result.stages.map((stage) => stage.stageKey);
  if (result.status === "blocked") {
    return {
      status: "blocked",
      draftId: result.draft.id,
      stageKeys,
      blockedStageKey: result.blockedStageKey,
    };
  }
  return {
    status: "queued",
    draftId: result.draft.id,
    stageKeys,
    projectId: result.project.id,
    projectName: result.project.name,
    cutId: result.cut.id,
    takeCount: result.takes.length,
  };
}
