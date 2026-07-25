import { z } from "zod";

/**
 * Shell-output validation boundary (SPINE §1: every shell output crosses
 * into the core through a Zod schema). Mirrors ../ingest/schemas.ts —
 * `packages/contracts` is frozen for this sprint, so this surface — new for
 * B1.2 — lives here instead; it still enforces the same rule: no
 * unvalidated shell output is ever written to a table.
 */
export const fanoutShellOutputSchema = z.object({
  body: z.string().min(1),
  format: z.string().optional(),
  /**
   * Phase 2c: the subject's canonical entities from the brief, declared by
   * the shell ([0] = the primary entity — "AI" for a post about AI).
   * Optional at the boundary: a shell that omits it still produces a valid
   * draft, and the core falls back to caller candidates + profile topics
   * (fanout/target-terms.ts) before ever writing meta.targetTerms.
   */
  targetTerms: z.array(z.string()).optional(),
});

export type FanoutShellOutput = z.infer<typeof fanoutShellOutputSchema>;
