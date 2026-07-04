import { z } from "zod";

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

/**
 * `drafts.meta` shape for every `clip_plan` draft this bucket produces —
 * B2.6's queue UI consumes this. `drafts.body` (the groundable text G3
 * checks against the transcript; `body_hash` binds verdicts to it, invariant
 * I1) is `hook + "\n\n" + captions + "\n\n" + platformCopy`; `meta` carries
 * the same three pieces individually (for structured display) plus the
 * clip's timing/candidate-window provenance and the same generation-key
 * inputs fan-out records on its drafts (promptVersion, brandProfileVersion,
 * platformProfileVersion).
 */
export const clipPlanDraftMetaSchema = z.object({
  /** Milliseconds into the source media where this clip starts/ends (CandidateWindow.startMs/endMs). */
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  /** Index into the run's derived CandidateWindow[] this draft was cut from. */
  windowIndex: z.number().int().min(0),
  /** `source_chunks.seq` values composing the window — chunk-level provenance. */
  chunkSeqs: z.array(z.number().int()),
  hook: z.string(),
  captions: z.string(),
  platformCopy: z.string(),
  promptVersion: z.string(),
  brandProfileVersion: z.number().int(),
  platformProfileVersion: z.string(),
});

export type ClipPlanDraftMeta = z.infer<typeof clipPlanDraftMetaSchema>;
