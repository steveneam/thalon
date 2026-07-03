/**
 * Every repository function in @thalon/db takes a TenantCtx as its first
 * argument (SPINE §2.6) — tenant scoping is app-enforced now, doubled by
 * Postgres RLS once Aurora lands (B0.5+). Never widen this to "optional".
 */
export interface TenantCtx {
  tenantId: string;
}

export function tenantCtx(tenantId: string): TenantCtx {
  if (!tenantId) throw new Error("tenantCtx requires a non-empty tenantId");
  return { tenantId };
}
