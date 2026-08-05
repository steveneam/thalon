import { NextResponse } from "next/server";
import {
  socialArmingWriteSchema,
  socialCadenceSchema,
  socialPublishConfigSchema,
  type SocialPublishConfig,
} from "@thalon/contracts";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * Control-arc parts A + A2 (s103): the arm control's write door — the QUEUE's
 * per-destination state, and the tenant-wide posting scope above it.
 *
 * ⛔ What this door does NOT do, stated because the two arming facts are easy
 * to confuse: it never touches whether a platform may be published to at all.
 * That is `socialArmed` — a connected credential plus an entry in this block —
 * and it governs a MANUAL publish from Approve. This door decides only
 * whether the unattended TICK may send a destination's due rows by itself,
 * and the tick's master key (`SOCIAL_QUEUE_ARMED`) still sits above
 * everything here, resting empty.
 *
 * One flip per request, and the union refuses the shapes that mean nothing.
 * The block is written whole through the repo's parse, so a flip can never
 * strand the rest of the tenant's posting config.
 */
export async function PATCH(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = socialArmingWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Send either a platform with its arm state, or a posting scope — one change per request.",
      },
      { status: 400 },
    );
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const profile = await repos.brandProfiles.getActive(ctx);
    if (!profile) {
      return NextResponse.json(
        { error: "This workspace has no active profile yet — nothing to arm against." },
        { status: 503 },
      );
    }
    // A malformed stored block must not become an excuse to overwrite the
    // tenant's posting config with a default one. The read fails loud; the
    // GET beside this one deliberately degrades instead, because rendering a
    // surface and rewriting storage are not the same risk.
    const current: SocialPublishConfig =
      profile.social === undefined || profile.social === null
        ? socialPublishConfigSchema.parse({})
        : socialPublishConfigSchema.parse(profile.social);

    let next: SocialPublishConfig;
    let summary: string;
    if ("postingScope" in parsed.data) {
      next = { ...current, postingScope: parsed.data.postingScope };
      summary = `posting scope → ${parsed.data.postingScope}`;
    } else {
      const { platform, armState } = parsed.data;
      // Arming a destination the tenant has never configured CREATES its
      // entry at the schema's own default cap — never a number written here.
      // That is a real widening and the surface states it before the first
      // flip: an entry in this block is also what authorizes a MANUAL publish
      // to the platform. The alternative — writing the state without the
      // entry — would be a dead control, because nothing else in the product
      // creates one. An existing entry's cadence is preserved verbatim, so a
      // flip never resets a cap (or a subreddit) the operator set.
      const cadence = current[platform] ?? socialCadenceSchema.parse({});
      next = { ...current, [platform]: { ...cadence, armState } };
      summary = `${platform} → ${armState}`;
    }

    const row = await repos.brandProfiles.updateSocialConfig(ctx, next, { summary });
    if (!row) {
      return NextResponse.json(
        { error: "The active profile changed underneath this write — nothing was stored." },
        { status: 409 },
      );
    }
    return NextResponse.json({ social: row.social });
  } catch (err) {
    return toErrorResponse(err);
  }
}
