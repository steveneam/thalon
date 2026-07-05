import { BudgetExceededError } from "@thalon/db";

/**
 * THE bounded shell→core repair loop (B4.1 — one loop; the per-format
 * copies in origination/webpage/demo delegate here). SPINE §1 doctrine:
 * every shell output crosses into the core through a Zod-validated, bounded
 * repair-retry loop. A thrown driver error, a schema-invalid candidate, and
 * a semantically invalid candidate (the per-format `validate` hook) are
 * treated identically — each consumes one of the bounded attempts. The
 * driver is expected to already be wrapped in `withGatewayGuard` by the
 * caller, so every attempt (including repair retries) is metered through
 * the one gateway choke point.
 */

export interface ValidatedCallResult<TOut> {
  output: TOut | null;
  attempts: number;
  /** True when every repair attempt was exhausted without a valid candidate. */
  irrecoverable: boolean;
  /** The LAST attempt's failure, verbatim (driver error message, Zod issue summary, or the `validate` hook's message) — operational failures and bad model output look identical to the loop; this is how an operator tells them apart (B1.5 lesson). */
  lastError?: string;
}

/** Structural Zod-schema view — exactly what the loop consumes, no zod generics coupling. */
export interface CandidateSchema<TOut> {
  safeParse(input: unknown):
    | { success: true; data: TOut }
    | { success: false; error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] } };
}

export interface ValidatedCallOpts<TOut> {
  maxAttempts?: number;
  /**
   * Format-specific checks a schema-valid candidate must ALSO pass (webpage:
   * structural page checks; demo: flow-map targets + duplicate steps).
   * Returns the COMPLETE `lastError` string, or null to accept. A failure
   * consumes a repair attempt exactly like a schema failure: to the loop, a
   * semantically invalid candidate IS a malformed candidate.
   */
  validate?: (output: TOut) => string | null;
}

const DEFAULT_MAX_ATTEMPTS = 3;

export async function generateValidatedCandidate<TReq, TOut>(
  driver: (req: TReq) => Promise<{ candidate: unknown }>,
  req: TReq,
  schema: CandidateSchema<TOut>,
  opts: ValidatedCallOpts<TOut> = {},
): Promise<ValidatedCallResult<TOut>> {
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
    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      lastError = `schema-invalid candidate: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`;
      if (attempt === maxAttempts) break;
      continue;
    }
    const problem = opts.validate?.(parsed.data) ?? null;
    if (problem) {
      lastError = problem;
      if (attempt === maxAttempts) break;
      continue;
    }
    return { output: parsed.data, attempts: attempt, irrecoverable: false };
  }
  return { output: null, attempts: maxAttempts, irrecoverable: true, lastError };
}
