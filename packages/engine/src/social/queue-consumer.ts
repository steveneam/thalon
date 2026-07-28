import { tenantCtx, type SocialPlatform } from "@thalon/contracts";
import type { PublishQueueRow, Repos } from "@thalon/db";
import type { EnvSource } from "@thalon/platform";
import { publishApprovedDraft } from "./publish";
import type { SocialPublisher } from "./registry";

/**
 * C3 (s82): the QUEUE CONSUMER tick — `publish_queue`'s second missing
 * end. It claims due rows and walks each one through the EXISTING publish
 * door, whose refusal ladder (a→f) is untouched: this file adds no rung,
 * removes none, and reaches no platform itself.
 *
 * ⛔ IT SHIPS DISARMED, AND THAT IS NOT A CONFIGURATION DETAIL. With
 * `SOCIAL_QUEUE_ARMED` absent the tick REPORTS and touches nothing: it
 * reads what is due, says what it would do, and writes not one row. Rows
 * sit `pending`. Arming, the per-platform GO and the per-post GO all stay
 * the founder's, and the standing sequence gate is verbatim: *"we're not
 * posting anything yet until all the walks are verified and fixed."*
 *
 * Structurally, not just by flag: `deps.resolvePublisher` has NO
 * network-reaching default (the B-pub.1 convention). An armed tick without
 * an injected resolver throws before it reads a single row, so no wiring
 * mistake can arrive at a platform call by accident.
 *
 * Shape mirrors the proven sweep scheduler (../trend/sweep-scheduler.ts,
 * live as a systemd user unit since s65): the clock is ALWAYS an argument,
 * one row's failure never blocks the others, every failure reason lands
 * VERBATIM, and the pass returns a report a thin driver can log.
 *
 * THE RECOVERY PATTERN IS CARRIED FROM DAY ONE. `releaseStale` runs at the
 * TOP of an armed pass, before anything is claimed: a consumer killed
 * mid-publish otherwise strands its row in `processing` with nothing able
 * to move it. Postiz needed a whole `missing.post` workflow to learn this;
 * the repo's own release is honest about what it cannot know (whether the
 * platform call happened), and the publish door's duplicate rung (e) is
 * what makes the re-run safe.
 */

/** The arming seat — a decision, so it is its own key and must read exactly "true" (the `readArm` convention). */
export const SOCIAL_QUEUE_ARM_KEY = "SOCIAL_QUEUE_ARMED";

/**
 * Is the consumer armed? Absence, an empty string, "1", "TRUE" and
 * anything else all mean NO — the same exactly-"true" rule the per-platform
 * arming ratchet uses, because a value that nearly says yes must never arm
 * a seam.
 */
export function publishQueueArmed(env: EnvSource): boolean {
  return env[SOCIAL_QUEUE_ARM_KEY] === "true";
}

export interface RunDuePublishesDeps {
  repos: Repos;
  /**
   * ARMED = write. Absent or false, the pass is a report: zero claims, zero
   * transitions, zero platform calls. Callers derive it from
   * `publishQueueArmed(env)`; nothing defaults it to true.
   */
  armed?: boolean;
  /**
   * The publisher seam — REQUIRED when armed, no default (./publish.ts's
   * own posture). Resolved per tenant, because arming is tenant data since
   * B-int.3 and the vault view is per-tenant.
   */
  resolvePublisher?: (
    tenantId: string,
  ) => Promise<(platform: SocialPlatform) => SocialPublisher> | ((platform: SocialPlatform) => SocialPublisher);
  /** How many due rows one pass takes (the repo's own default is 50). */
  limit?: number;
  /** A row claimed longer ago than this is presumed abandoned and released. */
  staleAfterMinutes?: number;
}

/** One due row, as the report names it — never the whole row, which carries no reader here. */
export interface DuePublishItem {
  id: string;
  tenantId: string;
  draftId: string;
  platform: string;
  scheduledAt: string | null;
}

export interface DuePublishFailure extends DuePublishItem {
  /** The thrown message, verbatim — an unarmed platform's refusal reads exactly as the door wrote it. */
  reason: string;
}

export interface RunDuePublishesResult {
  /** Whether this pass could write at all. false = a report; nothing was touched. */
  armed: boolean;
  /** Rows whose time has come at `now`, across every tenant (the system-level read). */
  due: DuePublishItem[];
  /** Stale `processing` rows returned to `pending` at the top of the pass. Always empty while disarmed. */
  released: DuePublishItem[];
  /** Rows that reached the platform and were recorded. */
  published: Array<DuePublishItem & { externalPostId: string }>;
  /** Rows the door refused or that failed — terminal, with the reason on the row. */
  failed: DuePublishFailure[];
  /** Rows another consumer claimed first — the database resolved the race and this pass moved on. */
  raced: DuePublishItem[];
}

function item(row: PublishQueueRow): DuePublishItem {
  return {
    id: row.id,
    tenantId: row.tenantId,
    draftId: row.draftId,
    platform: row.platform,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
  };
}

/**
 * One consumer pass. Idempotent against `now` in the sense that matters: a
 * second pass at the same instant finds the rows it published no longer
 * pending, and the publish door's duplicate rung refuses anything that
 * somehow came round twice.
 */
export async function runDuePublishes(
  deps: RunDuePublishesDeps,
  now: Date,
): Promise<RunDuePublishesResult> {
  const { repos } = deps;
  const armed = deps.armed === true;

  // Loud, and BEFORE any read: an armed tick with no publisher seam is a
  // wiring mistake, and the only safe thing to do with it is refuse to run.
  if (armed && !deps.resolvePublisher) {
    throw new Error(
      "runDuePublishes is ARMED but no resolvePublisher was wired — the consumer has no network-reaching default by design; wire the vault-first resolver or leave the tick disarmed",
    );
  }

  const result: RunDuePublishesResult = {
    armed,
    due: [],
    released: [],
    published: [],
    failed: [],
    raced: [],
  };

  // Recovery FIRST, so a row released this pass is eligible in the very
  // same pass rather than waiting a full tick to be noticed.
  if (armed) {
    const staleBefore = new Date(now.getTime() - (deps.staleAfterMinutes ?? 15) * 60_000);
    result.released = (await repos.publishQueue.releaseStale(staleBefore, now)).map(item);
  }

  const due = await repos.publishQueue.listDue(now, deps.limit);
  result.due = due.map(item);

  // Disarmed: the report IS the whole pass. Nothing above wrote, nothing
  // below runs, and `due` says exactly what an armed tick would have tried.
  if (!armed) return result;

  for (const row of due) {
    const ctx = tenantCtx(row.tenantId);
    // The claim's `status = 'pending'` predicate lives in the UPDATE, so
    // two consumers racing this row resolve in the database — the loser
    // gets null here and moves on rather than both publishing.
    const claimed = await repos.publishQueue.claim(row.id, now);
    if (!claimed) {
      result.raced.push(item(row));
      continue;
    }
    try {
      const resolvePublisher = await deps.resolvePublisher!(row.tenantId);
      const { publication } = await publishApprovedDraft(
        { ctx, repos, resolvePublisher },
        { draftId: row.draftId, platform: row.platform as SocialPlatform },
        now,
      );
      await repos.publishQueue.complete(ctx, row.id, {
        externalPostId: publication.externalPostId,
      });
      result.published.push({ ...item(claimed), externalPostId: publication.externalPostId });
    } catch (err) {
      // `failed` is TERMINAL by contract decision — no retry ladder. The row
      // names its reason and waits for an operator; re-queueing is a new,
      // deliberate act. An unarmed platform lands here with its typed refusal
      // verbatim, which is the correct behaviour and not a gap.
      const reason = err instanceof Error ? err.message : String(err);
      try {
        await repos.publishQueue.fail(ctx, row.id, { reason });
      } catch {
        // The failure write itself failed (likely the same outage that broke
        // the publish). The returned entry below still reports verbatim, and
        // the row stays `processing` for the stale release to recover.
      }
      result.failed.push({ ...item(claimed), reason });
    }
  }

  return result;
}
