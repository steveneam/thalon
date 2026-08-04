ALTER TABLE "video_cuts" ADD COLUMN "retired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "video_projects" ADD COLUMN "retired_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "video_cuts_tenant_project_retired_idx" ON "video_cuts" USING btree ("tenant_id","project_id","retired_at");--> statement-breakpoint
CREATE INDEX "video_projects_tenant_retired_idx" ON "video_projects" USING btree ("tenant_id","retired_at");
