import { z } from "zod";

/**
 * Shell-output validation boundary (SPINE §1: every shell output crosses
 * into the core through a Zod schema). `packages/contracts` is frozen for
 * this sprint, so this schema — new surface B1.1 introduces — lives here
 * instead; it still enforces the same rule: no unvalidated shell output is
 * ever written to a table.
 */
export const embedShellOutputSchema = z.object({
  vectors: z.array(z.array(z.number().finite())),
  model: z.string().min(1),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
});

export type EmbedShellOutput = z.infer<typeof embedShellOutputSchema>;
