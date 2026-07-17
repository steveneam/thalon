CREATE TABLE "outreach_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_message_id" text NOT NULL,
	"recipient_email" text NOT NULL,
	"body_hash" text NOT NULL,
	"touch_index" integer DEFAULT 0 NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_sends_provider_check" CHECK (provider in ('resend'))
);
--> statement-breakpoint
ALTER TABLE "outreach_sends" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leads" DROP CONSTRAINT "leads_status_check";--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "consent_basis" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "consent_provenance" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "outreach_sends" ADD CONSTRAINT "outreach_sends_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_sends" ADD CONSTRAINT "outreach_sends_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_sends" ADD CONSTRAINT "outreach_sends_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "outreach_sends_tenant_draft_idx" ON "outreach_sends" USING btree ("tenant_id","draft_id");--> statement-breakpoint
CREATE INDEX "outreach_sends_tenant_sent_idx" ON "outreach_sends" USING btree ("tenant_id","sent_at");--> statement-breakpoint
CREATE INDEX "outreach_sends_tenant_lead_sent_idx" ON "outreach_sends" USING btree ("tenant_id","lead_id","sent_at");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_consent_basis_check" CHECK (consent_basis in ('express', 'inferred-published', 'none'));--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_status_check" CHECK (status in ('new', 'scored', 'contacted', 'dismissed', 'unsubscribed'));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "outreach_sends" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);