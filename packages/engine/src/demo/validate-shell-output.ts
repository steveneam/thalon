import { BudgetExceededError } from "@thalon/db";
import { flowMapPageUrls, flowMapSelectors, type FlowMap } from "./flow-map";
import {
  storyboardShellOutputSchema,
  type StoryboardShellOutput,
  type StoryboardStepCandidate,
} from "./schemas";
import type { StoryboardDriver, StoryboardRequest } from "./shell/generator";

export interface StoryboardCallResult {
  output: StoryboardShellOutput | null;
  attempts: number;
  /** True when every repair attempt was exhausted without a schema-valid candidate. */
  irrecoverable: boolean;
  /**
   * The LAST attempt's failure, verbatim (driver error message, Zod issue
   * summary, or an invalid/contradictory step). Operational failures look
   * identical to bad model output from the loop's perspective — this is the
   * only way an operator can tell them apart, so never discard it (mirrors
   * ../waterfall/validate-shell-output.ts's `lastError` contract).
   */
  lastError?: string;
}

const DEFAULT_MAX_ATTEMPTS = 3;

/** A duplicate (same action+target+value repeated) or a contradictory `fill` (same target, different values) — either strands the storyboard mid-persist just like waterfall's duplicate windowIndex. */
function findDuplicateOrContradiction(steps: readonly StoryboardStepCandidate[]): string | null {
  const seenExact = new Set<string>();
  const fillValueByTarget = new Map<string, string>();
  for (const step of steps) {
    const exactKey = `${step.action}:${step.target}:${step.value}`;
    if (seenExact.has(exactKey)) {
      return `duplicate step (${step.action} "${step.target}" with value "${step.value}" appears more than once)`;
    }
    seenExact.add(exactKey);
    if (step.action === "fill") {
      const prior = fillValueByTarget.get(step.target);
      if (prior !== undefined && prior !== step.value) {
        return `contradictory fill steps for target "${step.target}" ("${prior}" then "${step.value}")`;
      }
      fillValueByTarget.set(step.target, step.value);
    }
  }
  return null;
}

/**
 * The shell->core boundary guard (SPINE §1 doctrine): every shell output
 * crosses into the core through this Zod-validated, bounded repair-retry
 * loop — mirrors ../waterfall/validate-shell-output.ts exactly, plus the
 * B2.5-specific structural checks Zod alone can't express: a `goto` step's
 * `target` must be one of the crawled page URLs (`flowMapPageUrls`); every
 * other action's `target` must be one of the flow map's affordance selectors
 * (`flowMapSelectors`) — the shell selects among core-derived facts, it never
 * invents a page or selector. A duplicate or contradictory step (waterfall's
 * lesson: an always-invalid shell must persist nothing) is treated
 * identically to a schema-invalid candidate and consumes one of the bounded
 * attempts. `driver` is expected to already be wrapped in `withGatewayGuard`
 * by the caller, so every attempt (including repair retries) is metered
 * through the one gateway choke point.
 */
export async function generateValidatedStoryboard(
  driver: StoryboardDriver,
  req: StoryboardRequest,
  flowMap: FlowMap,
  opts: { maxAttempts?: number } = {},
): Promise<StoryboardCallResult> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const pageUrls = new Set(flowMapPageUrls(flowMap));
  const selectors = new Set(flowMapSelectors(flowMap));
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
    const parsed = storyboardShellOutputSchema.safeParse(candidate);
    if (!parsed.success) {
      lastError = `schema-invalid candidate: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`;
      if (attempt === maxAttempts) break;
      continue;
    }
    const invalidTarget = parsed.data.steps.find((step) =>
      step.action === "goto" ? !pageUrls.has(step.target) : !selectors.has(step.target),
    );
    if (invalidTarget) {
      lastError =
        invalidTarget.action === "goto"
          ? `schema-invalid candidate: goto target "${invalidTarget.target}" is not a crawled page`
          : `schema-invalid candidate: "${invalidTarget.action}" target "${invalidTarget.target}" is not a flow-map affordance`;
      if (attempt === maxAttempts) break;
      continue;
    }
    const problem = findDuplicateOrContradiction(parsed.data.steps);
    if (problem) {
      lastError = `schema-invalid candidate: ${problem}`;
      if (attempt === maxAttempts) break;
      continue;
    }
    return { output: parsed.data, attempts: attempt, irrecoverable: false };
  }
  return { output: null, attempts: maxAttempts, irrecoverable: true, lastError };
}
