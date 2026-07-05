import { z } from "zod";

/**
 * B4.2: the PINNED `clip_plan` draft-meta contract lives in the format
 * contract registry — @thalon/contracts/format-registry.ts — beside every
 * other format's meta schema and capabilities. Re-exported here so engine
 * call sites keep their import paths. `drafts.body` (the groundable text G3
 * checks against the transcript; `body_hash` binds verdicts to it,
 * invariant I1) is `hook + "\n\n" + captions + "\n\n" + platformCopy` —
 * declared as the registry entry's `expectedBody`; `meta` carries the same
 * three pieces individually (for structured display) plus the clip's
 * timing/candidate-window provenance and the same generation-key inputs
 * fan-out records on its drafts.
 */
export { clipPlanDraftMetaSchema, type ClipPlanDraftMeta } from "@thalon/contracts";

/**
 * Shell-output validation boundary (SPINE §1: every shell output crosses
 * into the core through a Zod schema) for the B2.3 highlight-select step —
 * mirrors ../fanout/schemas.ts. One call ranks/selects clips for ONE
 * platform at a time (mirroring fan-out's per-platform generation loop, so
 * partial-run backfill can retry exactly the missing platform — see
 * ../waterfall.ts). `windowIndex` must reference one of the candidate
 * windows the caller passed into that call; Zod alone can't see that bound,
 * so it's checked in ./validate-shell-output.ts.
 */
export const highlightSelectShellOutputSchema = z.object({
  clips: z
    .array(
      z.object({
        /** Index into the CandidateWindow[] this call was given — the shell selects among core-derived windows, it never invents new timing. */
        windowIndex: z.number().int().min(0),
        hook: z.string().min(1),
        captions: z.string().min(1),
        platformCopy: z.string().min(1),
      }),
    )
    .min(1),
});

export type HighlightSelectShellOutput = z.infer<typeof highlightSelectShellOutputSchema>;
export type ClipSelection = HighlightSelectShellOutput["clips"][number];
