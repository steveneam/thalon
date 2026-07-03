import { z } from "zod";

/**
 * The shell/core boundary contract for G3 tier judges (SPINE §1 doctrine:
 * "every shell output crosses into the core through a Zod schema"). Screen
 * and final tiers both produce this same shape so their verdicts are
 * directly comparable (ratified decision 2 — a tier disagreement blocks the
 * draft rather than being resolved in either direction).
 */
export const shellClaimSchema = z.object({
  claim: z.string(),
  supported: z.boolean(),
  /** Id of the provided source chunk that grounds this claim, when supported. */
  chunkRef: z.string().optional(),
});

export const shellJudgeOutputSchema = z.object({
  verdict: z.enum(["pass", "fail"]),
  claims: z.array(shellClaimSchema).default([]),
  notes: z.string().optional(),
});

export type ShellClaim = z.infer<typeof shellClaimSchema>;
export type ShellJudgeOutput = z.infer<typeof shellJudgeOutputSchema>;
