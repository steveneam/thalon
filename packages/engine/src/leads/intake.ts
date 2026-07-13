import type { LeadInput, TenantCtx } from "@thalon/contracts";
import type { Repos, WaitlistEntry } from "@thalon/db";

/**
 * B-crm.1 waitlist→leads bridge (founder answer 3: auto-bridge approved —
 * every signup becomes a lead; dismissal is one click). Pure mapping +
 * an idempotent sync job: the leads dedupe key does all the replay work,
 * so re-running bridges only new signups. The waitlist stays the system of
 * record for referral mechanics — the lead carries the referral context
 * along in `meta` (data, never re-derived).
 */

/** Pure: one waitlist entry → the lead intake shape. */
export function waitlistEntryToLeadInput(entry: WaitlistEntry): LeadInput {
  return {
    source: "waitlist",
    email: entry.email,
    meta: {
      waitlist: {
        position: entry.position,
        referralCode: entry.referralCode,
        referredBy: entry.referredBy,
        joinedAt: entry.createdAt.toISOString(),
      },
    },
  };
}

export interface WaitlistSyncResult {
  /** Waitlist entries seen this run. */
  seen: number;
  /** New leads created (first bridge of that signup). */
  added: number;
  /** Signups already bridged (or already present via another source) — replays add nothing. */
  existing: number;
}

/** The sync job — safe to run any number of times, on any schedule. */
export async function syncWaitlistLeads(ctx: TenantCtx, repos: Repos): Promise<WaitlistSyncResult> {
  const entries = await repos.waitlist.list(ctx);
  let added = 0;
  for (const entry of entries) {
    const { created } = await repos.leads.add(ctx, waitlistEntryToLeadInput(entry));
    if (created) added++;
  }
  return { seen: entries.length, added, existing: entries.length - added };
}
