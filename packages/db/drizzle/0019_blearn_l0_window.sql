CREATE TABLE "trend_admissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"day" text NOT NULL,
	"slot" integer NOT NULL,
	"content_hash" text NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trend_admissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trend_admissions" ADD CONSTRAINT "trend_admissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_admissions" ADD CONSTRAINT "trend_admissions_area_id_monitored_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."monitored_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trend_admissions_tenant_area_day_slot_idx" ON "trend_admissions" USING btree ("tenant_id","area_id","day","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "trend_admissions_tenant_area_day_content_idx" ON "trend_admissions" USING btree ("tenant_id","area_id","day","content_hash");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "trend_admissions" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);