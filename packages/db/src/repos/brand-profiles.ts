import {
  brandProfileConfigSchema,
  type BrandProfileConfigInput,
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
