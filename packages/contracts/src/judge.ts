import { z } from "zod";

/**
 * Judge gate vocabulary. judge_results.gate is deliberately open-ended text in
 * the schema so G2 (claims-match), G4 (platform policy), and G5 (AI
 * disclosure) need zero migrations later — but the gates the engine knows
 * about today are enumerated here.
 */
export const KNOWN_JUDGE_GATES = ["g1", "g3_screen", "g3_final"] as const;
export type KnownJudgeGate = (typeof KNOWN_JUDGE_GATES)[number];

/** Invariant I1: `→ queued` requires a passing row from THIS gate for the draft's current body hash. */
export const FINAL_JUDGE_GATE = "g3_final";

/** Invariant I2 (Sprint 3+): `→ published` additionally requires a passing row from THIS gate. */
export const DISCLOSURE_GATE = "g5";

export const VERDICTS = ["pass", "fail"] as const;
export type Verdict = (typeof VERDICTS)[number];

/** Per-claim structured evidence stored on judge_results.evidence (SPINE §2.5). */
export const judgeClaimSchema = z.object({
  claim: z.string(),
  verdict: z.enum(VERDICTS),
  evidence: z.string().optional(),
  sourceRef: z.string().optional(),
});

export const judgeEvidenceSchema = z.object({
  claims: z.array(judgeClaimSchema).default([]),
  notes: z.string().optional(),
});

export type JudgeClaim = z.infer<typeof judgeClaimSchema>;
export type JudgeEvidence = z.infer<typeof judgeEvidenceSchema>;
