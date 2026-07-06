import type { TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { SITE_URL } from "@/lib/site";
import { effectivePosition } from "./position";
import { generateReferralCode } from "./referral-code";

/** What the landing form renders after a signup — everything is derivable, nothing secret. */
export interface JoinResult {
  created: boolean;
  position: number;
  /** position after the "skip the line" referral math (position.ts). */
  effectivePosition: number;
  referrals: number;
  /** Total queue length — "you're #12 of 340". */
  total: number;
  referralCode: string;
  referralUrl: string;
}

/** Referral-code collisions are loud unique violations by contract — retry with fresh entropy, bounded. */
const CODE_ATTEMPTS = 3;

/**
 * The whole join flow over the FROZEN Sprint-6 contract: resolve the
 * referral, join idempotently, derive the shown position. An unknown or
 * expired `ref` code degrades to a direct signup — a broken share link must
 * never block the one conversion moment the landing page has.
 */
export async function joinWaitlist(
  repos: Repos,
  ctx: TenantCtx,
  input: { email: string; ref?: string },
): Promise<JoinResult> {
  const referrer = input.ref ? await repos.waitlist.getByReferralCode(ctx, input.ref) : null;

  let joined: Awaited<ReturnType<typeof repos.waitlist.join>> | undefined;
  for (let attempt = 1; ; attempt++) {
    try {
      joined = await repos.waitlist.join(ctx, {
        email: input.email,
        referralCode: generateReferralCode(),
        referredBy: referrer?.id,
      });
      break;
    } catch (err) {
      const collision = err instanceof Error && err.message.includes("referral_code");
      if (!collision || attempt >= CODE_ATTEMPTS) throw err;
    }
  }

  const { entry, created } = joined;
  const [referrals, total] = await Promise.all([
    repos.waitlist.countReferrals(ctx, entry.id),
    repos.waitlist.count(ctx),
  ]);

  return {
    created,
    position: entry.position,
    effectivePosition: effectivePosition(entry.position, referrals),
    referrals,
    total,
    referralCode: entry.referralCode,
    referralUrl: `${SITE_URL}/?ref=${entry.referralCode}`,
  };
}
