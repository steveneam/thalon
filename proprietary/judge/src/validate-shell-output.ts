import type { Verdict } from "@thalon/contracts";
import { BudgetExceededError } from "@thalon/db";
import type { JudgeModelDriver, JudgeModelRequest } from "./shell/driver";
import { shellJudgeOutputSchema, type ShellJudgeOutput } from "./shell/schema";

export interface TierCallResult {
  verdict: Verdict;
  output: ShellJudgeOutput | null;
  attempts: number;
  /** True when every repair attempt was exhausted without a schema-valid candidate. */
  irrecoverable: boolean;
  /**
   * The LAST attempt's failure, verbatim (driver error message or Zod issue
   * summary). An irrecoverable FAIL can be operational (429 rate limit,
   * provider format rejection) rather than editorial — the operator triaging
   * a blocked draft needs to see which one it was (lesson: the first live
   * B1.5 dogfood blocked both drafts on what looked like model output but
   * was free-tier throttling of the final tier).
   */
  lastError?: string;
}

const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * The shell→core boundary guard (SPINE §1 doctrine): every shell output
 * crosses into core through this Zod-validated, bounded repair-retry loop.
 * A thrown driver error and a schema-invalid candidate are treated
 * identically — both consume one of the bounded attempts. Exhausting every
 * attempt is irrecoverable and is reported as a FAIL, never a silent pass.
 */
export async function callTierJudge(
  driver: JudgeModelDriver,
  req: JudgeModelRequest,
  opts: { maxAttempts?: number } = {},
): Promise<TierCallResult> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let candidate: unknown;
    try {
      candidate = (await driver(req)).candidate;
    } catch (err) {
      // A blown tenant budget is an operational hard stop (amendment A2),
      // not a repairable shell hiccup — retrying it would only re-assert
      // and re-emit budget.exceeded events. Fail loud, all the way up.
      if (err instanceof BudgetExceededError) throw err;
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt === maxAttempts) break;
      continue;
    }
    const parsed = shellJudgeOutputSchema.safeParse(candidate);
    if (parsed.success) {
      return {
        verdict: parsed.data.verdict,
        output: parsed.data,
        attempts: attempt,
        irrecoverable: false,
      };
    }
    lastError = `schema-invalid candidate: ${parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")}`;
    if (attempt === maxAttempts) break;
  }
  return { verdict: "fail", output: null, attempts: maxAttempts, irrecoverable: true, lastError };
}
