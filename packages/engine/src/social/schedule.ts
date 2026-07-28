import {
  resolveDraftFormatSpec,
  socialPlatformSchema,
  type SocialPlatform,
  type TenantCtx,
} from "@thalon/contracts";
import type { PublishQueueRow, Repos } from "@thalon/db";
import { readDraftFitMedia, validateForPlatform, type PlatformFit } from "./capability";
import {
  SocialDraftNotApprovedError,
  SocialFormatNotPublishableError,
  SocialPostDoesNotFitError,
  SocialScheduleInPastError,
} from "./errors";

/**
 * C2 (s82): the QUEUE PRODUCER — Approve's *Schedule* verb, and the first
 * of `publish_queue`'s two missing ends. An approved `post`-family draft +
 * a platform + a slot becomes one committed queue row through the frozen
 * repo, or it is refused with the reason on its face.
 *
 * The refusal ladder mirrors the publish door's (./publish.ts a→f) as far
 * as a producer can honestly go, and stops exactly where the door's own
 * job begins:
 *
 *   a. draft exists (tenant-walled get), resolves to a `publishable`
 *      format, status APPROVED — a draft that has not passed the judge and
 *      the operator cannot be committed to a time;
 *   b. the slot is in the FUTURE — a past instant is due immediately, which
 *      is "publish now" wearing a schedule's clothes;
 *   c. it FITS (C1, the frozen capability matrix): a post the platform will
 *      bounce never becomes a commitment, so the fix is free rather than
 *      paid for with a live call that fails;
 *   d. `publishQueue.enqueue` — idempotency, the second-live-row clash and
 *      the event all belong to the repo, not to this file.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK — arming. Scheduling for a platform
 * that is not armed is legitimate and common: the row sits `pending`, and
 * the consumer's walk through the publish door is where an unarmed platform
 * fails closed and says so. Refusing here would make the queue unusable
 * before the founder's per-platform GO, which is the opposite of the point.
 *
 * A PLANNED SLOT AND A QUEUE ROW STAY DISTINCT FACTS. This writes only the
 * queue row; `planned_slots` is untouched. "I was thinking Tuesday" and
 * "this goes out at 09:30" are different claims with different consequences,
 * and the calendar says which is which.
 */
export interface ScheduleApprovedDraftDeps {
  ctx: TenantCtx;
  repos: Repos;
}

export interface ScheduleApprovedDraftInput {
  draftId: string;
  platform: SocialPlatform | string;
  /** The committed instant, with an offset (the contract's `publishQueueEnqueueSchema` shape). */
  scheduledAt: string | Date;
}

export interface ScheduleApprovedDraftResult {
  row: PublishQueueRow;
  /** false = this exact schedule already existed; the replay wrote nothing (the repo's idempotency). */
  created: boolean;
  /** The measurement the fit rung passed on — what the Approve fit line shows for a scheduled row. */
  fit: PlatformFit;
}

export async function scheduleApprovedDraft(
  deps: ScheduleApprovedDraftDeps,
  input: ScheduleApprovedDraftInput,
  now: Date,
): Promise<ScheduleApprovedDraftResult> {
  const { ctx, repos } = deps;
  const platform = socialPlatformSchema.parse(input.platform);
  const scheduledAt = input.scheduledAt instanceof Date ? input.scheduledAt : new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new TypeError(`"scheduledAt" is not an instant: ${String(input.scheduledAt)}`);
  }

  // (a) the same eligibility the publish door asks — read the registry flag,
  // never a format-name branch, so a future postable format is a registry
  // edit rather than a second list to keep in sync.
  const draft = await repos.drafts.get(ctx, input.draftId);
  const spec = resolveDraftFormatSpec(draft.format);
  if (!spec.capabilities.publishable) {
    throw new SocialFormatNotPublishableError(draft.id, draft.format);
  }
  if (draft.status !== "approved") {
    throw new SocialDraftNotApprovedError(draft.id, draft.status);
  }

  // (b) the clock is an argument, never read here (SPINE §1) — so "is this
  // in the past" is replayable in tests rather than true only on the day.
  if (scheduledAt.getTime() <= now.getTime()) {
    throw new SocialScheduleInPastError(scheduledAt, now);
  }

  // (c) the fit rung — measured on the draft's CURRENT body, never on a
  // stamp written at generation (an edit changes the body and nothing
  // refreshes that stamp).
  const fit = validateForPlatform({
    platform,
    body: draft.body,
    media: readDraftFitMedia(draft.meta),
  });
  if (!fit.fits) throw new SocialPostDoesNotFitError(platform, fit.problems);

  // (d) the frozen write door owns idempotency, the clash refusal and the
  // event. Nothing here re-implements any of them.
  const { row, created } = await repos.publishQueue.enqueue(ctx, {
    draftId: draft.id,
    platform,
    scheduledAt: scheduledAt.toISOString(),
  });
  return { row, created, fit };
}

/**
 * THE NEXT-FREE-SLOT SUGGESTION — derived from the operator's OWN
 * `planned_slots` grammar rather than a second scheduling vocabulary
 * invented for the queue.
 *
 * The rule, stated once: reuse the time-of-day the operator already plans
 * at (the most recent existing instant's exact time of day), roll it
 * forward to the first day where it is at least `leadMinutes` away and at
 * least `gapMinutes` from everything already planned or queued. With no
 * history at all there is nothing to derive from, so it falls back to the
 * calendar's own snap: `now + leadMinutes`, rounded up to the next
 * 15-minute boundary (`SNAP_MINUTES`, calendar-model.ts).
 *
 * Pure and clock-free. Time-of-day is carried as milliseconds-since-UTC-
 * midnight of the reference instant, which reproduces the operator's own
 * wall-clock choice exactly except across a DST boundary in their zone,
 * where it lands an hour out — a suggestion the operator sees and can
 * change, never a stored fact, so the honest simple rule beats a zone
 * database the engine has no business carrying.
 */
export interface SuggestSlotInput {
  /** Every instant the operator has already committed to or planned — planned slots AND live queue rows. */
  taken: readonly Date[];
  now: Date;
  /** How far ahead the earliest suggestion may be. */
  leadMinutes?: number;
  /** How far a suggestion must stay from anything already taken. */
  gapMinutes?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SNAP_MINUTES = 15;

export function suggestNextSlot(input: SuggestSlotInput): Date {
  const leadMs = (input.leadMinutes ?? 60) * 60_000;
  const gapMs = (input.gapMinutes ?? 60) * 60_000;
  const earliest = input.now.getTime() + leadMs;
  const taken = [...input.taken].map((d) => d.getTime()).sort((a, b) => a - b);

  const clear = (at: number) => taken.every((t) => Math.abs(t - at) >= gapMs);

  // No history: the calendar's own snap, and nothing else pretended.
  if (taken.length === 0) {
    const step = SNAP_MINUTES * 60_000;
    return new Date(Math.ceil(earliest / step) * step);
  }

  // The operator's own rhythm: the time of day of their most recent instant.
  const reference = taken[taken.length - 1];
  const timeOfDay = ((reference % DAY_MS) + DAY_MS) % DAY_MS;
  let candidate = Math.floor(earliest / DAY_MS) * DAY_MS + timeOfDay;
  if (candidate < earliest) candidate += DAY_MS;
  // Bounded: one candidate a day for a fortnight. A calendar so full that
  // fourteen days hold no clear slot is a real answer, not a spin — the
  // caller gets the last candidate and the operator moves it.
  for (let day = 0; day < 14 && !clear(candidate); day += 1) candidate += DAY_MS;
  return new Date(candidate);
}
