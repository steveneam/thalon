import { generateValidatedCandidate, type ValidatedCallResult } from "../pipeline/repair-loop";
import { flowMapPageUrls, flowMapSelectors, type FlowMap } from "./flow-map";
import {
  storyboardShellOutputSchema,
  type StoryboardShellOutput,
  type StoryboardStepCandidate,
} from "./schemas";
import type { StoryboardDriver, StoryboardRequest } from "./shell/generator";

export type StoryboardCallResult = ValidatedCallResult<StoryboardShellOutput>;

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
 * The shell→core boundary guard for storyboards: the shared bounded repair
 * loop (../pipeline/repair-loop.ts, B4.1) plus the B2.5-specific semantic
 * checks Zod alone can't express — a `goto` step's `target` must be one of
 * the crawled page URLs (`flowMapPageUrls`); every other action's `target`
 * must be one of the flow map's affordance selectors (`flowMapSelectors`)
 * (the shell selects among core-derived facts, it never invents a page or
 * selector); and a duplicate or contradictory step (waterfall's lesson: an
 * always-invalid shell must persist nothing) is treated identically to a
 * schema-invalid candidate.
 */
export async function generateValidatedStoryboard(
  driver: StoryboardDriver,
  req: StoryboardRequest,
  flowMap: FlowMap,
  opts: { maxAttempts?: number } = {},
): Promise<StoryboardCallResult> {
  const pageUrls = new Set(flowMapPageUrls(flowMap));
  const selectors = new Set(flowMapSelectors(flowMap));
  return generateValidatedCandidate(driver, req, storyboardShellOutputSchema, {
    maxAttempts: opts.maxAttempts,
    validate: (output) => {
      const invalidTarget = output.steps.find((step) =>
        step.action === "goto" ? !pageUrls.has(step.target) : !selectors.has(step.target),
      );
      if (invalidTarget) {
        return invalidTarget.action === "goto"
          ? `schema-invalid candidate: goto target "${invalidTarget.target}" is not a crawled page`
          : `schema-invalid candidate: "${invalidTarget.action}" target "${invalidTarget.target}" is not a flow-map affordance`;
      }
      const problem = findDuplicateOrContradiction(output.steps);
      return problem ? `schema-invalid candidate: ${problem}` : null;
    },
  });
}
