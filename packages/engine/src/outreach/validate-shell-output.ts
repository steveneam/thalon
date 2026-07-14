import { generateValidatedCandidate, type ValidatedCallResult } from "../pipeline/repair-loop";
import { outreachEmailShellOutputSchema, type OutreachEmailShellOutput } from "./schemas";
import type { GenerateOutreachEmailRequest, OutreachEmailDriver } from "./shell/generator";

export type OutreachEmailCallResult = ValidatedCallResult<OutreachEmailShellOutput>;

/**
 * The shell→core boundary guard for outreach emails: pure schema validation,
 * no extra semantic checks — the shared bounded repair loop
 * (../pipeline/repair-loop.ts, B4.1) does all the work.
 */
export async function generateValidatedOutreachEmail(
  driver: OutreachEmailDriver,
  req: GenerateOutreachEmailRequest,
  opts: { maxAttempts?: number } = {},
): Promise<OutreachEmailCallResult> {
  return generateValidatedCandidate(driver, req, outreachEmailShellOutputSchema, {
    maxAttempts: opts.maxAttempts,
  });
}
