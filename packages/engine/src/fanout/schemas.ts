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
});

export type FanoutShellOutput = z.infer<typeof fanoutShellOutputSchema>;
