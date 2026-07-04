import { BudgetExceededError } from "@thalon/db";
import { highlightSelectShellOutputSchema, type HighlightSelectShellOutput } from "./schemas";
import type { HighlightSelectDriver, HighlightSelectRequest } from "./shell/generator";

export interface HighlightSelectCallResult {
  output: HighlightSelectShellOutput | null;
  attempts: number;
  /** True when every repair attempt was exhausted without a schema-valid candidate. */
  irrecoverable: boolean;
  /**
   * The LAST attempt's failure, verbatim (driver error message, Zod issue
   * summary, or out-of-range windowIndex). Operational failures look
   * identical to bad model output from the loop's perspective — this is the
   * only way an operator can tell them apart, so never discard it (mirrors
   * ../fanout/validate-shell-output.ts's lastError contract).
   */
  lastError?: string;
}

const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * The shell->core boundary guard (SPINE §1 doctrine): every shell output
 * crosses into the core through this Zod-validated, bounded repair-retry
 * loop — mirrors ../fanout/validate-shell-output.ts exactly, plus one
 * domain-specific check Zod alone can't express: every clip's `windowIndex`
 * must reference one of the candidate windows `req.candidateWindows` this
 * call was actually given (the shell selects among core-derived windows, it
 * never invents new timing) — an out-of-range index is treated identically
 * to a schema-invalid candidate and consumes one of the bounded attempts.
 * `driver` is expected to already be wrapped in `withGatewayGuard` by the
 * caller, so every attempt (including repair retries) is metered through the
 * one gateway choke point.
 */
export async function generateValidatedHighlightSelect(
  driver: HighlightSelectDriver,
  req: HighlightSelectRequest,
  opts: { maxAttempts?: number } = {},
): Promise<HighlightSelectCallResult> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let candidate: unknown;
    try {
      candidate = (await driver(req)).candidate;
    } catch (err) {
      // A blown tenant budget is an operational hard stop (amendment A2),
      // not a repairable shell hiccup — surface it, never swallow it.
      if (err instanceof BudgetExceededError) throw err;
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt === maxAttempts) break;
      continue;
    }
    const parsed = highlightSelectShellOutputSchema.safeParse(candidate);
    if (!parsed.success) {
      lastError = `schema-invalid candidate: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`;
      if (attempt === maxAttempts) break;
      continue;
    }
    const outOfRange = parsed.data.clips.find(
      (clip) => clip.windowIndex >= req.candidateWindows.length,
    );
    if (outOfRange) {
      lastError = `schema-invalid candidate: windowIndex ${outOfRange.windowIndex} out of range (only ${req.candidateWindows.length} candidate window(s) provided)`;
      if (attempt === maxAttempts) break;
      continue;
    }
    return { output: parsed.data, attempts: attempt, irrecoverable: false };
  }
  return { output: null, attempts: maxAttempts, irrecoverable: true, lastError };
}
