-- 0013 (s53, RESERVED number — parallel lane holds 0012): tenancy RLS ratchet,
-- INVARIANT class (never loosened). Every tenant-scoped table gets ENABLE ROW
-- LEVEL SECURITY plus a `tenant_isolation` policy keyed on the transaction-local
-- `app.tenant_id` session setting (set via DbHandle.withTenantSession; missing or
-- empty setting ⇒ NULL ⇒ zero rows — deny by default, never fail open).
--
-- WHAT THIS ACTUALLY ENFORCES (honest scope, not marketing):
--   * Policies bind ONLY roles that neither own the table nor hold
--     SUPERUSER/BYPASSRLS. Dev PGlite connects as the `postgres` superuser and
--     the dev server driver connects as the table owner, so in BOTH of today's
--     environments this migration changes no behavior — it is a latent second
--     belt; primary enforcement remains the app layer (TenantCtx on every repo
--     call, contracts/src/tenant.ts).
--   * Enforcement becomes real the moment the app connects as a dedicated
--     NON-OWNER role with plain table grants — the intended staging/production
--     posture. Isolation under such a role is proven by
--     packages/db/src/__tests__/rls-isolation.test.ts (SELECT/INSERT/UPDATE/
--     DELETE all blocked cross-tenant, invisible without tenant context).
--   * FORCE ROW LEVEL SECURITY is deliberately NOT set: the app does not yet
--     pin app.tenant_id on its connections, so FORCE would zero out every
--     owner-connection read today. Adding FORCE once the app-side session
--     wiring lands is the next ratchet turn — one ALTER per table, never the
--     reverse.
--   * Deliberately WITHOUT policies: `tenants` (the identity anchor — slug
--     lookup must precede tenant context), `llm_cache` and `retrieval_cache`
--     (content-addressed cross-tenant caches by documented design, see
--     schema/ops.ts). Pinned in __tests__/rls-ratchet.test.ts.
ALTER TABLE "drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fanout_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "source_chunks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "source_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "monitored_areas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trend_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "watchlists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "approvals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "edit_diffs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "eval_cases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "judge_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "publish_queue" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usage_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "search_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "search_targets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "video_cuts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "video_projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "video_takes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "waitlist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "drafts" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "fanout_runs" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "source_chunks" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "source_metrics" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sources" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "monitored_areas" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "trend_snapshots" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "watchlists" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "approvals" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "edit_diffs" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "eval_cases" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "judge_results" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "lead_scores" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "leads" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "events" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "publish_queue" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "usage_ledger" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "search_snapshots" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "search_targets" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "brand_profiles" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "video_cuts" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "video_projects" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "video_takes" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "waitlist" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);