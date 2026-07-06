import { monitoredAreaConfigSchema, MONITORED_AREA_STATUSES } from "@thalon/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/http-errors";
import { toAreaRow } from "@/lib/intel/serialize";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    config: monitoredAreaConfigSchema.optional(),
    status: z.enum(MONITORED_AREA_STATUSES).optional(),
  })
  .refine((p) => Object.keys(p).length > 0, { message: "empty patch" });

/** Edit / pause / resume one monitored area (pause stops query expansion, keeps history). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ areaId: string }> },
) {
  const { areaId } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const row = await repos.monitoredAreas.update(ctx, areaId, parsed.data);
    return NextResponse.json({ area: toAreaRow(row) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
