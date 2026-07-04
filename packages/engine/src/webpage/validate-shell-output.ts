import { BudgetExceededError } from "@thalon/db";
import { extractVisibleText, selfContainmentViolations } from "./html";
import { webPageShellOutputSchema, type WebPageShellOutput } from "./schemas";
import type { GenerateWebPageRequest, WebPageDriver } from "./shell/generator";

export interface WebPageCallResult {
  output: WebPageShellOutput | null;
  attempts: number;
  /** True when every repair attempt was exhausted without a valid candidate. */
  irrecoverable: boolean;
  /** The LAST attempt's failure, verbatim (driver error, Zod issue summary, or self-containment violations) — operational failures and bad model output look identical to the loop; this is how an operator tells them apart (B1.5 lesson). */
  lastError?: string;
}

const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * The shell→core boundary guard (SPINE §1 doctrine) — mirrors
 * ../origination/validate-shell-output.ts, with one addition: a
 * schema-valid candidate must ALSO pass the structural page checks
 * (./html.ts — full document, no scripts, no external loads, non-empty
 * visible text). A structural violation consumes a repair attempt exactly
 * like a schema failure: to the loop, an unjudgeable or leaky page IS a
 * malformed candidate. `driver` is expected to already be wrapped in
 * `withGatewayGuard` by the caller, so every attempt (including repair
 * retries) is metered through the one gateway choke point.
 */
export async function generateValidatedWebPage(
  driver: WebPageDriver,
  req: GenerateWebPageRequest,
  opts: { maxAttempts?: number } = {},
): Promise<WebPageCallResult> {
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
    const parsed = webPageShellOutputSchema.safeParse(candidate);
    if (!parsed.success) {
      lastError = `schema-invalid candidate: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`;
      if (attempt === maxAttempts) break;
      continue;
    }
    const violations = selfContainmentViolations(parsed.data.html);
    if (extractVisibleText(parsed.data.html).length === 0) {
      violations.push("page has no judgeable visible text");
    }
    if (violations.length > 0) {
      lastError = `structurally invalid page: ${violations.join("; ")}`;
      if (attempt === maxAttempts) break;
      continue;
    }
    return { output: parsed.data, attempts: attempt, irrecoverable: false };
  }
  return { output: null, attempts: maxAttempts, irrecoverable: true, lastError };
}
