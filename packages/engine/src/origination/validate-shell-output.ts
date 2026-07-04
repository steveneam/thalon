import { BudgetExceededError } from "@thalon/db";
import { pillarScriptShellOutputSchema, type PillarScriptShellOutput } from "./schemas";
import type { GeneratePillarScriptRequest, PillarScriptDriver } from "./shell/generator";

export interface PillarScriptCallResult {
  output: PillarScriptShellOutput | null;
  attempts: number;
  /** True when every repair attempt was exhausted without a schema-valid candidate. */
  irrecoverable: boolean;
  /** The LAST attempt's failure, verbatim (driver error message or Zod issue summary) — operational failures and bad model output look identical to the loop; this is how an operator tells them apart (B1.5 lesson). */
  lastError?: string;
}

const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * The shell→core boundary guard (SPINE §1 doctrine): every shell output
 * crosses into the core through this Zod-validated, bounded repair-retry
 * loop — mirrors ../fanout/validate-shell-output.ts. A thrown driver error
 * and a schema-invalid candidate are treated identically — both consume one
 * of the bounded attempts. `driver` is expected to already be wrapped in
 * `withGatewayGuard` by the caller, so every attempt (including repair
 * retries) is metered through the one gateway choke point.
 */
export async function generateValidatedPillarScript(
  driver: PillarScriptDriver,
  req: GeneratePillarScriptRequest,
  opts: { maxAttempts?: number } = {},
): Promise<PillarScriptCallResult> {
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
    const parsed = pillarScriptShellOutputSchema.safeParse(candidate);
    if (parsed.success) {
      return { output: parsed.data, attempts: attempt, irrecoverable: false };
    }
    lastError = `schema-invalid candidate: ${parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")}`;
    if (attempt === maxAttempts) break;
  }
  return { output: null, attempts: maxAttempts, irrecoverable: true, lastError };
}
