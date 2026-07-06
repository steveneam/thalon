CREATE TABLE "monitored_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monitored_areas_status_check" CHECK (status in ('active', 'paused'))
);
--> statement-breakpoint
CREATE TABLE "search_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source" text NOT NULL,
	"query" text NOT NULL,
	"page" text DEFAULT '' NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"origin" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_targets_origin_check" CHECK (origin in ('profile_seed', 'ai_expansion', 'operator')),
	CONSTRAINT "search_targets_status_check" CHECK (status in ('active', 'dismissed'))
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"referral_code" text NOT NULL,
	"referred_by" uuid,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monitored_areas" ADD CONSTRAINT "monitored_areas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_snapshots" ADD CONSTRAINT "search_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_targets" ADD CONSTRAINT "search_targets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_referred_by_waitlist_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."waitlist"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monitored_areas_tenant_name_idx" ON "monitored_areas" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "monitored_areas_tenant_status_idx" ON "monitored_areas" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "search_snapshots_tenant_query_captured_idx" ON "search_snapshots" USING btree ("tenant_id","source","query","page","captured_at");--> statement-breakpoint
CREATE INDEX "search_snapshots_tenant_source_captured_idx" ON "search_snapshots" USING btree ("tenant_id","source","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "search_targets_tenant_keyword_idx" ON "search_targets" USING btree ("tenant_id","keyword");--> statement-breakpoint
CREATE INDEX "search_targets_tenant_status_idx" ON "search_targets" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_tenant_email_idx" ON "waitlist" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_tenant_referral_code_idx" ON "waitlist" USING btree ("tenant_id","referral_code");--> statement-breakpoint
CREATE INDEX "waitlist_tenant_referred_by_idx" ON "waitlist" USING btree ("tenant_id","referred_by");