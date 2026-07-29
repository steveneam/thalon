CREATE TABLE "create_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"family" text NOT NULL,
	"mode" text NOT NULL,
	"brief" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"plan" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"children" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"generation_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "create_runs_generation_key_unique" UNIQUE("generation_key"),
	CONSTRAINT "create_runs_family_check" CHECK (family in ('post', 'video', 'page', 'email')),
	CONSTRAINT "create_runs_status_check" CHECK (status in ('pending', 'running', 'complete', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "create_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "publication_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"publication_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"metric_label" text NOT NULL,
	"metric_value" double precision NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publication_metrics_platform_check" CHECK (platform in ('linkedin', 'x', 'facebook', 'instagram', 'tiktok', 'reddit', 'bluesky'))
);
--> statement-breakpoint
ALTER TABLE "publication_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "create_runs" ADD CONSTRAINT "create_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_metrics" ADD CONSTRAINT "publication_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_metrics" ADD CONSTRAINT "publication_metrics_publication_id_social_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."social_publications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "create_runs_tenant_created_idx" ON "create_runs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_metrics_tenant_pub_label_at_idx" ON "publication_metrics" USING btree ("tenant_id","publication_id","metric_label","captured_at");--> statement-breakpoint
CREATE INDEX "publication_metrics_tenant_pub_idx" ON "publication_metrics" USING btree ("tenant_id","publication_id");--> statement-breakpoint
CREATE INDEX "publication_metrics_tenant_platform_captured_idx" ON "publication_metrics" USING btree ("tenant_id","platform","captured_at");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "create_runs" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "publication_metrics" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);