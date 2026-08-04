import { z } from "zod";
import { socialPlatformSchema } from "./social";

/**
 * s82 window (W1): the shapes for `publish_queue` — a table that has existed
 * since B0.3 with **neither end wired** (no repo, no producer, no consumer).
 * The s82 lanes finish it: Approve gains a *Schedule* verb that writes a row,
 * and a consumer tick walks due rows through the EXISTING publish door.
 *
 * ⛔ The sequence gate is untouched by anything in this file. A queue row is
 * an *intent to publish*, never a publish: the row's terminal states are
 * reached only by a consumer that ships DISARMED, and every refusal rung of
 * the publish door (a–f) still stands in front of any platform call.
 *
 * Two facts stay deliberately distinct, and the calendar says which is which:
 * a **planned slot** (`planned_slots`) is the operator's intent to post
 * around some time; a **queue row** is a commitment with an idempotency key
 * behind it. Collapsing them would make "I was thinking Tuesday" and "this
 * will go out at 09:30" the same fact.
 */

/**
 * The ARM STATE that gates this queue (`off` · `review` · `live`) is declared
 * in `./social.ts` beside `socialCadenceSchema`, the per-destination config
 * block that carries it. It would read better here, next to the vocabulary it
 * gates — but this module already imports that one, so declaring it here is a
 * cycle. See that file's header for the ladder and why it narrows a GO.
 */

export const PUBLISH_QUEUE_STATUSES = [
  "pending",
  "processing",
  "published",
  "failed",
  "cancelled",
] as const;
export type PublishQueueStatus = (typeof PUBLISH_QUEUE_STATUSES)[number];
export const publishQueueStatusSchema = z.enum(PUBLISH_QUEUE_STATUSES);

/**
 * The rulebook, mirroring `VIDEO_CUT_TRANSITIONS`. Two choices worth stating
 * because they are decisions, not defaults:
 *
 *   - **`failed` is terminal.** No automatic retry ladder. A row that failed
 *     names its reason and waits for an operator; re-queueing is a new,
 *     deliberate act. Under the standing sequence gate, a queue that retries
 *     by itself is exactly the thing nobody has authorised.
 *   - **`processing → pending` exists**, and is the only backwards edge: the
 *     stale-claim release. A consumer that dies mid-tick leaves its row
 *     claimed forever otherwise — the recovery pattern the Postiz study named
 *     (`missing.post`), carried from day one rather than discovered in
 *     production.
 */
export const PUBLISH_QUEUE_TRANSITIONS: Readonly<
  Record<PublishQueueStatus, readonly PublishQueueStatus[]>
> = {
  pending: ["processing", "cancelled"],
  processing: ["published", "failed", "pending"],
  published: [],
  failed: [],
  cancelled: [],
};

export class InvalidPublishQueueTransitionError extends Error {
  constructor(
    public readonly from: PublishQueueStatus,
    public readonly to: PublishQueueStatus,
  ) {
    super(
      `invalid publish queue transition "${from}" -> "${to}" (allowed from "${from}": ${
        PUBLISH_QUEUE_TRANSITIONS[from].join(", ") || "none — terminal state"
      })`,
    );
    this.name = "InvalidPublishQueueTransitionError";
  }
}

export function assertPublishQueueTransition(
  from: PublishQueueStatus,
  to: PublishQueueStatus,
): void {
  if (!PUBLISH_QUEUE_TRANSITIONS[from].includes(to)) {
    throw new InvalidPublishQueueTransitionError(from, to);
  }
}

/**
 * What the Schedule verb hands the queue. `scheduledAt` is REQUIRED here even
 * though the column is nullable (a dormant table's column may not be
 * tightened outside a mandate): "publish this at some unspecified moment" is
 * not a thing an operator can consent to, so the write door demands a time
 * while the column keeps its shape.
 */
export const publishQueueEnqueueSchema = z.object({
  draftId: z.uuid(),
  platform: socialPlatformSchema,
  scheduledAt: z.iso.datetime({ offset: true }),
});
export type PublishQueueEnqueueInput = z.input<typeof publishQueueEnqueueSchema>;
