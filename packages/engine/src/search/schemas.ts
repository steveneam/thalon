import { z } from "zod";

/** The keyword-expansion shell→core boundary shape (B6.8): candidates only — core gates and persists. */
export const keywordExpansionShellOutputSchema = z.object({
  keywords: z
    .array(
      z.object({
        /** One plausible query a person would type. */
        keyword: z.string().min(1),
        /** One line tying the keyword to the identity — persisted as target provenance. */
        rationale: z.string().min(1),
      }),
    )
    .min(1),
});
export type KeywordExpansionShellOutput = z.infer<typeof keywordExpansionShellOutputSchema>;
