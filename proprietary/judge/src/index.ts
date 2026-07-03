/**
 * The judge harness (B1.3): G1 denylist (pure core fn) + G3 two-tier
 * grounding (shell verdicts, core enforcement). Verdicts are appended via
 * `repos.judgeResults` (body-hash-bound) and the queue opens only through
 * `@thalon/db`'s transition function's I1 check — this package can never
 * bypass it (see `pipeline.ts`).
 */
export { runG1Denylist, type G1Result, type RunG1Input } from "./g1-denylist";
export { runJudgePipeline, type PipelineOutcome, type RunJudgePipelineInput } from "./pipeline";
export { callTierJudge, type TierCallResult } from "./validate-shell-output";
export {
  gatewayJudgeDriver,
  promptVersionFor,
  type JudgeModelCall,
  type JudgeModelDriver,
  type JudgeModelRequest,
  type JudgeTier,
  type SourceChunkInput,
} from "./shell/driver";
export { shellJudgeOutputSchema, type ShellClaim, type ShellJudgeOutput } from "./shell/schema";
