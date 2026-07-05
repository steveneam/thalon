import { z } from "zod";
import { pillarBeatSchema } from "@thalon/contracts";

/**
 * B4.2: the PINNED `pillar_script` draft-meta contract (and the beat shape
 * it builds on) lives in the format contract registry —
 * @thalon/contracts/format-registry.ts — beside every other format's meta
 * schema and capabilities. Re-exported here so engine call sites keep their
 * import paths.
 */
export {
  pillarBeatSchema,
  pillarScriptDraftMetaSchema,
  type PillarBeat,
  type PillarScriptDraftMeta,
} from "@thalon/contracts";

/**
 * B3.9 shell→core boundary: the pillar-script generator's output contract
 * (SPINE §1 — shell returns candidates only; core validates here before
 * anything persists). A pillar script is the judged artifact a pillar video
 * is rendered from at B3.10: an ordered list of beats, each carrying its
 * narration line (the caption/SRT text is derived from exactly these lines),
 * optional on-screen text, an optional visual hint for the render composition,
 * and an optional duration hint. The shell emits beats WITHOUT `beatIndex`
 * (core assigns it from array order once the candidate survives validation).
 */
export const pillarScriptShellOutputSchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1),
  beats: z.array(pillarBeatSchema).min(1).max(40),
  cta: z.string().min(1).optional(),
});

export type PillarScriptShellOutput = z.infer<typeof pillarScriptShellOutputSchema>;
