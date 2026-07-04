import { BudgetExceededError } from "@thalon/db";
import { fanoutShellOutputSchema, type FanoutShellOutput } from "./schemas";
import type { DraftGeneratorDriver, GenerateDraftRequest } from "./shell/generator";

export interface GenerateCallResult {
  output: FanoutShellOutput | null;
  attempts: number;
  /** True when every repair attempt was exhausted without a schema-valid candidate. */
  irrecoverable: boolean;
}

const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * The shell->core boundary guard (SPINE §1 doctrine): every shell output
 * crosses into the core through this Zod-validated, bounded repair-retry
 * loop — mirrors proprietary/judge's validate-shell-output.ts. A thrown
 * driver error and a schema-invalid candidate are treated identically —
 * both consume one of the bounded attempts. `driver` is expected to already
 * be wrapped in `withGatewayGuard` by the caller, so every attempt
 * (including repair retries) is metered through the one gateway choke
 * point.
 */
export async function generateValidatedDraft(
  driver: DraftGeneratorDriver,
  req: GenerateDraftRequest,
  opts: { maxAttempts?: number } = {},
): Promise<GenerateCallResult> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let candidate: unknown;
    try {
      candidate = (await driver(req)).candidate;
    } catch (err) {
      // A blown tenant budget is an operational hard stop (amendment A2),
      // not a repairable shell hiccup — surface it, never swallow it.
      if (err instanceof BudgetExceededError) throw err;
      if (attempt === maxAttempts) break;
      continue;
    }
    const parsed = fanoutShellOutputSchema.safeParse(candidate);
    if (parsed.success) {
      return { output: parsed.data, attempts: attempt, irrecoverable: false };
    }
    if (attempt === maxAttempts) break;
  }
  return { output: null, attempts: maxAttempts, irrecoverable: true };
}
