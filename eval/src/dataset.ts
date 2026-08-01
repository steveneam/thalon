import { z } from "zod";

/**
 * The full origin vocabulary — mirrors eval_cases_origin_check
 * (packages/db/src/schema/judging.ts). Every learning door's origin must
 * appear here or its rows are unexportable: toJsonl schema-parses each
 * record, so a missing origin makes the export THROW, not skip (the s90
 * gap — lead_triage and cut_diff_review wrote rows the suite couldn't read).
 */
export const EVAL_ORIGINS = [
  "edit_diff",
  "golden",
  "manual",
  "intel_dismiss",
  "lead_triage",
  "cut_diff_review",
  "approve_reject",
] as const;

export type EvalOrigin = (typeof EVAL_ORIGINS)[number];

/**
 * One eval dataset record — the on-disk (JSONL) mirror of an eval_cases row.
 * Everything in the suite speaks this shape: exported operator overrides,
 * the committed golden seed, and (from B1.3) the harnesses that consume them.
 * Eval hygiene (SPINE §2.6): synthetic/demo data only, never PII.
 */
export const evalRecordSchema = z.object({
  kind: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  expected: z.record(z.string(), z.unknown()),
  origin: z.enum(EVAL_ORIGINS),
  sourceRef: z.string().nullish(),
});

export type EvalRecord = z.infer<typeof evalRecordSchema>;

export function toJsonl(records: EvalRecord[]): string {
  return records.map((r) => JSON.stringify(evalRecordSchema.parse(r))).join("\n") + "\n";
}

export function parseJsonl(text: string): EvalRecord[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line, i) => {
      const parsed = evalRecordSchema.safeParse(JSON.parse(line));
      if (!parsed.success) {
        throw new Error(`invalid eval record on line ${i + 1}: ${parsed.error.message}`);
      }
      return parsed.data;
    });
}
