CREATE TABLE "intel_captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intel_captures_kind_check" CHECK (kind in ('trend_dismiss', 'trend_promote', 'search_target_this', 'lead_promote'))
);
--> statement-breakpoint
ALTER TABLE "intel_captures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "planned_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "planned_slots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"surface" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_views_surface_check" CHECK (surface in ('leads', 'calendar'))
);
--> statement-breakpoint
ALTER TABLE "saved_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "capture_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "stage" text;--> statement-breakpoint
ALTER TABLE "intel_captures" ADD CONSTRAINT "intel_captures_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_slots" ADD CONSTRAINT "planned_slots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_slots" ADD CONSTRAINT "planned_slots_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intel_captures_tenant_created_idx" ON "intel_captures" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "planned_slots_tenant_draft_idx" ON "planned_slots" USING btree ("tenant_id","draft_id");--> statement-breakpoint
CREATE INDEX "planned_slots_tenant_scheduled_idx" ON "planned_slots" USING btree ("tenant_id","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_views_tenant_surface_name_idx" ON "saved_views" USING btree ("tenant_id","surface","name");--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_capture_id_intel_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."intel_captures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drafts_tenant_capture_idx" ON "drafts" USING btree ("tenant_id","capture_id");--> statement-breakpoint
CREATE INDEX "leads_tenant_stage_idx" ON "leads" USING btree ("tenant_id","stage");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_stage_check" CHECK (stage is null or stage in ('inbox', 'qualified', 'in_conversation', 'won', 'parked'));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "intel_captures" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "planned_slots" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "saved_views" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);