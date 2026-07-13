CREATE TABLE "lead_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"score" double precision NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"profile_hash" text NOT NULL,
	"scored_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source" text NOT NULL,
	"email" text NOT NULL,
	"email_hash" text NOT NULL,
	"name" text,
	"company" text,
	"role" text,
	"website" text,
	"notes" text,
	"status" text DEFAULT 'new' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_source_check" CHECK (source in ('waitlist', 'csv', 'api')),
	CONSTRAINT "leads_status_check" CHECK (status in ('new', 'scored', 'dismissed'))
);
--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "icp" jsonb;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "cadence" jsonb;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "routing" jsonb;--> statement-breakpoint
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_scores_tenant_lead_profile_scored_idx" ON "lead_scores" USING btree ("tenant_id","lead_id","profile_hash","scored_at");--> statement-breakpoint
CREATE INDEX "lead_scores_tenant_lead_scored_idx" ON "lead_scores" USING btree ("tenant_id","lead_id","scored_at");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_tenant_email_hash_idx" ON "leads" USING btree ("tenant_id","email_hash");--> statement-breakpoint
CREATE INDEX "leads_tenant_status_idx" ON "leads" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "leads_tenant_created_idx" ON "leads" USING btree ("tenant_id","created_at");