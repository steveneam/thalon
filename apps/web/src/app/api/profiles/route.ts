import { brandProfileConfigSchema, tenantCtx } from "@thalon/contracts";
import type { BrandProfile } from "@thalon/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/http-errors";
import type { ProfileHistoryEntry, ProfileWire } from "@/lib/profiles/types";
import { getRepos } from "@/lib/repos";
import { demoTenantSlug } from "@/lib/tenant";

function toWire(row: BrandProfile): ProfileWire {
  return {
    id: row.id,
    version: row.version,
    active: row.active,
    config: {
      voice: (row.voice ?? {}) as Record<string, unknown>,
      denylist: (row.denylist ?? []) as string[],
      platformProfiles: (row.platformProfiles ?? {}) as Record<string, Record<string, unknown>>,
      identity: (row.identity ?? {}) as Record<string, unknown>,
      // Window-1 blocks ride the wire whenever set (validated at the write
      // door, hence the honest casts) — omitting them made every editor
      // save silently drop them (2026-07-14 staging dogfood find).
      ...(row.icp != null ? { icp: row.icp as ProfileWire["config"]["icp"] } : {}),
      ...(row.cadence != null ? { cadence: row.cadence as ProfileWire["config"]["cadence"] } : {}),
      ...(row.routing != null ? { routing: row.routing as ProfileWire["config"]["routing"] } : {}),
    },
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * The active profile + version history. History reads the events spine
 * (brand_profile.created carries {version, active}) — the repo exposes only
 * getActive/create; a list/activate(version) read is a recorded follow-up
 * for the next contract window.
 */
export async function GET() {
  const repos = await getRepos();
  const tenant = await repos.tenants.getBySlug(demoTenantSlug());
  if (!tenant) return NextResponse.json({ active: null, history: [], tenant: null });
  const ctx = tenantCtx(tenant.id);
  const active = await repos.brandProfiles.getActive(ctx);
  const events = await repos.events.list(ctx, { entityType: "brand_profile", limit: 500 });
  const history: ProfileHistoryEntry[] = events
    .filter((e) => e.event === "brand_profile.created")
    .map((e) => {
      const payload = e.payload as { version?: number; active?: boolean };
      return {
        profileId: e.entityId,
        version: payload.version ?? 0,
        activatedOnCreate: payload.active ?? false,
        at: e.createdAt.toISOString(),
      };
    })
    .reverse();
  return NextResponse.json({
    active: active ? toWire(active) : null,
    history,
    tenant: { slug: tenant.slug, name: tenant.name },
  });
}

const saveSchema = z.object({
  config: brandProfileConfigSchema,
  tenantName: z.string().min(1).max(120).optional(),
});

/**
 * Save = a NEW active version (profiles are versioned, never edited in
 * place — drafts record the version they were generated under). First save
 * on a fresh dev db seeds the tenant row via the idempotent ensure — the
 * first-run flow's step 1 (dev seam; real operator→tenant mapping arrives
 * with auth).
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `Invalid profile config: ${issue.path.join(".")} — ${issue.message}` },
      { status: 400 },
    );
  }
  const repos = await getRepos();
  const slug = demoTenantSlug();
  const identityCompany = parsed.data.config.identity?.company;
  const tenant = await repos.tenants.ensure({
    slug,
    name: parsed.data.tenantName?.trim() || (typeof identityCompany === "string" && identityCompany) || slug,
  });
  try {
    const row = await repos.brandProfiles.create(tenantCtx(tenant.id), {
      config: parsed.data.config,
      activate: true,
    });
    return NextResponse.json({ profile: toWire(row) }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
