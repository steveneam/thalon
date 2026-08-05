import { socialPublishConfigSchema } from "@thalon/contracts";
import { listIntegrationCards } from "@thalon/engine";
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
    const cards = await listIntegrationCards(
      { repos, ctx, env: readEnv() },
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
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
