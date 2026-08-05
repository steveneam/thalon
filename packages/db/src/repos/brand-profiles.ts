import {
  brandProfileConfigSchema,
  socialPublishConfigSchema,
  type BrandProfileConfigInput,
  type SocialPublishConfig,
  type TenantCtx,
} from "@thalon/contracts";
import { and, desc, eq } from "drizzle-orm";
import { brandProfiles } from "../schema";
import type { BrandProfile, Db } from "../types";
import { appendEvent } from "./events";

export function brandProfilesRepo(db: Db) {
  return {
    /**
     * Inserts the next version of the tenant's config-as-data. Validation at
     * the boundary: the config is parsed against the contracts schema before
     * anything is written.
     */
    async create(
      ctx: TenantCtx,
      input: { config: BrandProfileConfigInput; activate?: boolean },
    ): Promise<BrandProfile> {
      const config = brandProfileConfigSchema.parse(input.config);
      return db.transaction(async (tx) => {
        const [latest] = await tx
          .select({ version: brandProfiles.version })
          .from(brandProfiles)
          .where(eq(brandProfiles.tenantId, ctx.tenantId))
          .orderBy(desc(brandProfiles.version))
          .limit(1);
        const version = (latest?.version ?? 0) + 1;
        if (input.activate) {
          await tx
            .update(brandProfiles)
            .set({ active: false })
            .where(eq(brandProfiles.tenantId, ctx.tenantId));
        }
        const [row] = await tx
          .insert(brandProfiles)
          .values({
            tenantId: ctx.tenantId,
            voice: config.voice,
            denylist: config.denylist,
            platformProfiles: config.platformProfiles,
            identity: config.identity,
            // Sprint-7/8 windows: optional blocks stay null when absent — the
            // features they arm (lead scoring, cadence gate, routing, social
            // publishing) disarm.
            icp: config.icp ?? null,
            cadence: config.cadence ?? null,
            routing: config.routing ?? null,
            outreach: config.outreach ?? null,
            social: config.social ?? null,
            platformRouting: config.platformRouting ?? null,
            version,
            active: input.activate ?? false,
          })
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "brand_profile",
          entityId: row.id,
          event: "brand_profile.created",
          payload: { version, active: row.active },
        });
        return row;
      });
    },

    /**
     * s103 (control-arc parts A/A2): the ONE in-place write on this repo, and
     * it is deliberate. Everything else here is append-only versioning,
     * because a brand profile is a record of how the BRAND evolved — voice,
     * denylist, identity. An arm state is not that: it is an operational
     * authorization fact an operator flips while working, and minting a brand
     * version per flip would bury the profile history it is supposed to
     * preserve under writes that say nothing about the brand.
     *
     * So the social block updates in place on the ACTIVE row and the history
     * goes where operational history belongs — the events spine, one event per
     * flip carrying what changed. Founder call, s103.
     *
     * Scoped to the tenant AND to `active`: an inactive version is a record of
     * the past and is never rewritten. Returns null when the tenant has no
     * active profile, so the caller can say so rather than silently no-op.
     */
    async updateSocialConfig(
      ctx: TenantCtx,
      social: SocialPublishConfig,
      event: { summary: string },
    ): Promise<BrandProfile | null> {
      // Parsed at the boundary like every other write on this repo — a stored
      // block is never trusted shapeless, whichever door it came through.
      const parsed = socialPublishConfigSchema.parse(social);
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(brandProfiles)
          .set({ social: parsed })
          .where(and(eq(brandProfiles.tenantId, ctx.tenantId), eq(brandProfiles.active, true)))
          .returning();
        if (!row) return null;
        await appendEvent(tx, ctx, {
          entityType: "brand_profile",
          entityId: row.id,
          event: "brand_profile.social_updated",
          payload: { version: row.version, summary: event.summary },
        });
        return row;
      });
    },

    async getActive(ctx: TenantCtx): Promise<BrandProfile | null> {
      const [row] = await db
        .select()
        .from(brandProfiles)
        .where(
          and(
            eq(brandProfiles.tenantId, ctx.tenantId),
            eq(brandProfiles.active, true),
          ),
        )
        .limit(1);
      return row ?? null;
    },
  };
}

export type BrandProfilesRepo = ReturnType<typeof brandProfilesRepo>;
