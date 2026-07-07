import { z } from "zod";

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
  origin: z.enum(["edit_diff", "golden", "manual", "intel_dismiss"]),
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
