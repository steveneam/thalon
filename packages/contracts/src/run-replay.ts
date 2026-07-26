import { z } from "zod";

/**
 * Fan-out replay (the s74 `runslib-rebuild` finding, riding the s77 media
 * window rather than waiting for a window of its own).
 *
 * Runs' sheet draws Retry on a failed row and the rebuild rendered it at full
 * fidelity — but **resting unarmed with its reason in the title**, because no
 * replay route exists anywhere. This is the shape that arms it. The route
 * itself is lane work against this frozen contract; a window ships storage
 * and validated shapes, never something that runs against live services.
 *
 * Two decisions are baked in because getting them wrong costs real money and
 * real provenance:
 *
 *  1. **A replay is a NEW run.** It never mutates the row it replays. The
 *     original kept its receipts (that is what the unarmed button's title
 *     already promises the operator), and the codebase's standing discipline
 *     is that history is append-only — a cut's re-edit is a new version, not
 *     an overwrite. So the result names a fresh run id and the failed run
 *     stays exactly as it failed, forever readable.
 *  2. **`failed_only` is the default.** A partial fan-out is the common
 *     failure: three platforms, two drafted, one died. Replaying all three
 *     would re-spend generation credits on two drafts that already exist and
 *     silently orphan them. The wide re-run stays available and explicit.
 */
export const RUN_REPLAY_SCOPES = ["failed_only", "all"] as const;
export type RunReplayScope = (typeof RUN_REPLAY_SCOPES)[number];

export const runReplayRequestSchema = z.strictObject({
  /** The run being replayed — must be one whose status recorded a failure. */
  runId: z.string().min(1),
  /**
   * Which platforms the replay covers. Defaults to the platforms that
   * actually failed; `all` re-runs the whole fan-out and is the operator's
   * deliberate choice, never an accident of an unset field.
   */
  scope: z.enum(RUN_REPLAY_SCOPES).default("failed_only"),
});
export type RunReplayRequestInput = z.input<typeof runReplayRequestSchema>;
export type RunReplayRequest = z.infer<typeof runReplayRequestSchema>;

/** Why a platform present on the original run was left out of the replay. */
export const RUN_REPLAY_SKIP_REASONS = ["already_succeeded", "not_routed"] as const;
export type RunReplaySkipReason = (typeof RUN_REPLAY_SKIP_REASONS)[number];

export const runReplayResultSchema = z.strictObject({
  /** The NEW run. The replayed run's own id is unchanged and still readable. */
  replayRunId: z.string().min(1),
  /** The run this one replays — the lineage pin, so a replay is never mistaken for an original. */
  replayedFromRunId: z.string().min(1),
  scope: z.enum(RUN_REPLAY_SCOPES),
  /** Platforms the replay actually fanned out to. */
  platforms: z.array(z.string().min(1)),
  /**
   * Platforms deliberately left out, each with its reason. An empty skip list
   * on a `failed_only` replay of a partial run would mean the scope did not
   * do its job, so the reasons are stated rather than inferred from a count.
   */
  skipped: z
    .array(
      z.strictObject({
        platform: z.string().min(1),
        reason: z.enum(RUN_REPLAY_SKIP_REASONS),
      }),
    )
    .default([]),
});
export type RunReplayResult = z.infer<typeof runReplayResultSchema>;
