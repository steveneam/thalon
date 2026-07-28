CREATE TABLE "oauth_states" (
	"state" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"destination" text NOT NULL,
	"code_verifier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "oauth_states_destination_check" CHECK (destination in ('linkedin', 'x', 'facebook', 'instagram', 'reddit', 'bluesky', 'website_hosted', 'website_wordpress', 'website_ghost', 'website_webhook', 'newsletter_resend', 'intel_youtube', 'intel_bluesky'))
);
--> statement-breakpoint
ALTER TABLE "oauth_states" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drafts" DROP CONSTRAINT "drafts_status_check";--> statement-breakpoint
ALTER TABLE "tenant_credentials" DROP CONSTRAINT "tenant_credentials_destination_check";--> statement-breakpoint
ALTER TABLE "social_publications" DROP CONSTRAINT "social_publications_platform_check";--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_states_tenant_idx" ON "oauth_states" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "oauth_states_expires_idx" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_status_check" CHECK (status in ('generated', 'judging', 'queued', 'approved', 'published', 'blocked', 'rejected'));--> statement-breakpoint
ALTER TABLE "tenant_credentials" ADD CONSTRAINT "tenant_credentials_destination_check" CHECK (destination in ('linkedin', 'x', 'facebook', 'instagram', 'reddit', 'bluesky', 'website_hosted', 'website_wordpress', 'website_ghost', 'website_webhook', 'newsletter_resend', 'intel_youtube', 'intel_bluesky'));--> statement-breakpoint
ALTER TABLE "social_publications" ADD CONSTRAINT "social_publications_platform_check" CHECK (platform in ('linkedin', 'x', 'facebook', 'instagram', 'tiktok', 'reddit', 'bluesky'));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "oauth_states" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);