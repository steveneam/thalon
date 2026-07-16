import { edlSchema, type VideoCutInput } from "@thalon/contracts";
import { compileEdl } from "@thalon/engine";
import { z } from "zod";
import { nextVersionFor } from "./editor";

/**
 * B-ve.3 save planning: a POST body + the project's existing cuts → the
 * VideoCutInput for the frozen create door. The version is DERIVED here
 * (max version for the name, +1) — a re-edit is always a new version, the
 * client never picks numbers. The EDL is compile-checked BEFORE it stores:
 * the zod schema admits shapes the compiler's honest caps refuse (two audio
 * cues, a mid-lane overlay), and a cut that can never render should be
 * refused at the door, loudly, not discovered minutes into a render.
 */

const saveCutRequestSchema = z.object({
  name: z.string().min(1),
  edl: edlSchema,
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type PlannedCutSave =
  | { ok: true; input: VideoCutInput }
  | { ok: false; status: 400 | 422; error: string };

export function planCutSave(
  existingCuts: { name: string; version: number }[],
  body: unknown,
): PlannedCutSave {
  const parsed = saveCutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, error: z.prettifyError(parsed.error) };
  }
  try {
    compileEdl(parsed.data.edl);
  } catch (err) {
    return {
      ok: false,
      status: 422,
      error: err instanceof Error ? err.message : "EDL does not compile",
    };
  }
  return {
    ok: true,
    input: {
      name: parsed.data.name,
      version: nextVersionFor(existingCuts, parsed.data.name),
      edl: parsed.data.edl,
      ...(parsed.data.meta ? { meta: parsed.data.meta } : {}),
    },
  };
}
