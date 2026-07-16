CREATE TABLE "video_cuts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"version" integer NOT NULL,
	"edl" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"output_ref" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_cuts_status_check" CHECK (status in ('draft', 'rendered', 'approved'))
);
--> statement-breakpoint
CREATE TABLE "video_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_takes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"slot" text,
	"kind" text NOT NULL,
	"disposition" text DEFAULT 'keeper' NOT NULL,
	"ref" text NOT NULL,
	"reason" text,
	"provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_takes_kind_check" CHECK (kind in ('motion', 'still', 'audio')),
	CONSTRAINT "video_takes_disposition_check" CHECK (disposition in ('keeper', 'reject'))
);
--> statement-breakpoint
ALTER TABLE "video_cuts" ADD CONSTRAINT "video_cuts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_cuts" ADD CONSTRAINT "video_cuts_project_id_video_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."video_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_projects" ADD CONSTRAINT "video_projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_takes" ADD CONSTRAINT "video_takes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_takes" ADD CONSTRAINT "video_takes_project_id_video_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."video_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "video_cuts_tenant_project_name_version_idx" ON "video_cuts" USING btree ("tenant_id","project_id","name","version");--> statement-breakpoint
CREATE INDEX "video_cuts_tenant_project_status_idx" ON "video_cuts" USING btree ("tenant_id","project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "video_projects_tenant_name_idx" ON "video_projects" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "video_takes_tenant_project_ref_idx" ON "video_takes" USING btree ("tenant_id","project_id","ref");--> statement-breakpoint
CREATE INDEX "video_takes_tenant_project_slot_idx" ON "video_takes" USING btree ("tenant_id","project_id","slot");