import { z } from "zod";

/**
 * The dossier shell's Zod boundary (B6.5 half-step): what one shell call
 * must return before core will even look at it. Bounds mirror the prompt
 * contract — 3–5 standalone titles, 2–3 genuinely distinct angles, one
 * spoken-voice hook. Lives in its own module so the shell can import it
 * without touching sweep's wire schemas.
 */
export const trendDossierShellOutputSchema = z.object({
  titles: z.array(z.string().trim().min(1).max(200)).min(3).max(5),
  angles: z.array(z.string().trim().min(1).max(300)).min(2).max(3),
  hook: z.string().trim().min(1).max(300),
});
export type TrendDossierShellOutput = z.infer<typeof trendDossierShellOutputSchema>;
