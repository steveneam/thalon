CREATE TABLE "source_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"metric_name" text NOT NULL,
	"metric_value" double precision NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sources" DROP CONSTRAINT "sources_kind_check";--> statement-breakpoint
ALTER TABLE "source_chunks" ADD COLUMN "start_ms" integer;--> statement-breakpoint
ALTER TABLE "source_chunks" ADD COLUMN "end_ms" integer;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "modality" text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "visual_ref" text;--> statement-breakpoint
ALTER TABLE "source_metrics" ADD CONSTRAINT "source_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_metrics" ADD CONSTRAINT "source_metrics_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_metrics_tenant_source_idx" ON "source_metrics" USING btree ("tenant_id","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_tenant_content_hash_idx" ON "sources" USING btree ("tenant_id","content_hash");--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_kind_check" CHECK (kind in ('url', 'prompt', 'doc', 'feature', 'video_transcript', 'exemplar', 'voice_sample', 'site_crawl'));