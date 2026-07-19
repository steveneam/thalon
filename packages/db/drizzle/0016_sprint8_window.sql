CREATE TABLE "sweep_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"cadence_minutes" integer DEFAULT 240 NOT NULL,
	"last_sweep_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sweep_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "social_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_post_id" text NOT NULL,
	"body_hash" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_publications_platform_check" CHECK (platform in ('linkedin', 'x', 'facebook', 'instagram', 'tiktok'))
);
--> statement-breakpoint
ALTER TABLE "social_publications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenant_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"feature" text NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_entitlements_feature_check" CHECK (feature in ('sites_templates', 'crm'))
);
--> statement-breakpoint
ALTER TABLE "tenant_entitlements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan" text DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "sweep_schedules" ADD CONSTRAINT "sweep_schedules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_publications" ADD CONSTRAINT "social_publications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_publications" ADD CONSTRAINT "social_publications_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_entitlements" ADD CONSTRAINT "tenant_entitlements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sweep_schedules_tenant_idx" ON "sweep_schedules" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_publications_tenant_draft_platform_idx" ON "social_publications" USING btree ("tenant_id","draft_id","platform");--> statement-breakpoint
CREATE INDEX "social_publications_tenant_platform_published_idx" ON "social_publications" USING btree ("tenant_id","platform","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_entitlements_tenant_feature_idx" ON "tenant_entitlements" USING btree ("tenant_id","feature");--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_plan_check" CHECK (plan in ('internal', 'starter', 'growth', 'max'));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sweep_schedules" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "social_publications" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "tenant_entitlements" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);