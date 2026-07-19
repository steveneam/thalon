CREATE TABLE "tenant_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"destination" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"ciphertext" text NOT NULL,
	"data_key_wrapped" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"connected_as" text,
	"validated_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_credentials_destination_check" CHECK (destination in ('linkedin', 'x', 'facebook', 'instagram', 'website_hosted', 'website_wordpress', 'website_ghost', 'website_webhook', 'newsletter_resend', 'intel_youtube', 'intel_bluesky')),
	CONSTRAINT "tenant_credentials_status_check" CHECK (status in ('connected', 'needs_reauth'))
);
--> statement-breakpoint
ALTER TABLE "tenant_credentials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_credentials" ADD CONSTRAINT "tenant_credentials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_credentials_tenant_destination_idx" ON "tenant_credentials" USING btree ("tenant_id","destination");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "tenant_credentials" AS PERMISSIVE FOR ALL TO public USING (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid) WITH CHECK (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);