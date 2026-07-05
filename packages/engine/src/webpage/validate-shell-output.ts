import { generateValidatedCandidate, type ValidatedCallResult } from "../pipeline/repair-loop";
import { extractVisibleText, selfContainmentViolations } from "./html";
import { webPageShellOutputSchema, type WebPageShellOutput } from "./schemas";
import type { GenerateWebPageRequest, WebPageDriver } from "./shell/generator";

export type WebPageCallResult = ValidatedCallResult<WebPageShellOutput>;

/**
 * The shell→core boundary guard for web pages: the shared bounded repair
 * loop (../pipeline/repair-loop.ts, B4.1) plus this format's semantic
 * check — a schema-valid candidate must ALSO pass the structural page
 * checks (./html.ts — full document, no scripts, no external loads,
 * non-empty visible text). A structural violation consumes a repair attempt
 * exactly like a schema failure: to the loop, an unjudgeable or leaky page
 * IS a malformed candidate.
 */
export async function generateValidatedWebPage(
  driver: WebPageDriver,
  req: GenerateWebPageRequest,
  opts: { maxAttempts?: number } = {},
): Promise<WebPageCallResult> {
  return generateValidatedCandidate(driver, req, webPageShellOutputSchema, {
    maxAttempts: opts.maxAttempts,
    validate: (output) => {
      const violations = selfContainmentViolations(output.html);
      if (extractVisibleText(output.html).length === 0) {
        violations.push("page has no judgeable visible text");
      }
      return violations.length > 0 ? `structurally invalid page: ${violations.join("; ")}` : null;
    },
  });
}
