import { socialPublishConfigSchema } from "@thalon/contracts";
import { listIntegrationCards, publishQueueArmed, SOCIAL_QUEUE_ARM_KEY } from "@thalon/engine";
import { readEnv } from "@thalon/platform";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * B-int.2 (ADR 0011): the Integrations cards read — every registry
 * destination in one of the frozen honest states, entitlements folded in.
 * Derivation is engine `listIntegrationCards`; this route only serializes.
 * Cards are the REDACTED projection by construction — no envelope field
 * exists on the engine type.
 */
export async function GET() {
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const { features } = await repos.entitlements.getEffective(ctx);
    // s78: arming is tenant DATA (the active profile's social block), and the
    // card states it — so the read carries it in. A malformed stored block
    // disarms rather than throwing: the surface must still render.
    const profile = await repos.brandProfiles.getActive(ctx);
    const parsedSocial =
      profile?.social === undefined || profile.social === null
        ? null
        : socialPublishConfigSchema.safeParse(profile.social);
    const env = readEnv();
    const cards = await listIntegrationCards(
      { repos, ctx, env },
      { features, socialConfig: parsedSocial?.success ? parsedSocial.data : null },
    );
    return NextResponse.json({
      cards: cards.map((card) => ({
        ...card,
        validatedAt: card.validatedAt?.toISOString() ?? null,
        expiresAt: card.expiresAt?.toISOString() ?? null,
      })),
      // s103 (part A2): the tenant-wide posting scope the per-destination
      // states are read under. A malformed or absent block reads `selective`,
      // the same answer the engine's resolver gives — the surface must never
      // be the place that decides `all` on its own.
      postingScope: (parsedSocial?.success ? parsedSocial.data.postingScope : null) ?? "selective",
      /**
       * Phase 0 (s112): the MASTER key, the third gate and the one the surface
       * has never been able to see. `SOCIAL_QUEUE_ARMED` lives in the env, so
       * until now the arm control could offer "Live — due posts go out on
       * their own" while the tick was incapable of sending anything at all: a
       * control asserting what the engine will not do.
       *
       * It ships as a DISCLOSURE and never as a door. Nothing here can change
       * it — arming the queue is a deployment act and the founder's
       * sequence-gate call — but the surface must stop claiming an outcome the
       * box cannot produce. Same derivation the consumer uses, so the page and
       * the tick can never disagree about it.
       */
      // The validated env is a typed object, so hand the predicate exactly the
      // one key it reads - same function and same key as the consumer, so the
      // page and the tick cannot disagree about whether the queue is armed.
      queueArmed: publishQueueArmed({ [SOCIAL_QUEUE_ARM_KEY]: env[SOCIAL_QUEUE_ARM_KEY] }),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
