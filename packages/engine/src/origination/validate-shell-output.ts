import { generateValidatedCandidate, type ValidatedCallResult } from "../pipeline/repair-loop";
import { pillarScriptShellOutputSchema, type PillarScriptShellOutput } from "./schemas";
import type { GeneratePillarScriptRequest, PillarScriptDriver } from "./shell/generator";

export type PillarScriptCallResult = ValidatedCallResult<PillarScriptShellOutput>;

/**
 * The shell→core boundary guard for pillar scripts: pure schema validation,
 * no extra semantic checks — the shared bounded repair loop
 * (../pipeline/repair-loop.ts, B4.1) does all the work.
 */
export async function generateValidatedPillarScript(
  driver: PillarScriptDriver,
  req: GeneratePillarScriptRequest,
  opts: { maxAttempts?: number } = {},
): Promise<PillarScriptCallResult> {
  return generateValidatedCandidate(driver, req, pillarScriptShellOutputSchema, {
    maxAttempts: opts.maxAttempts,
  });
}
