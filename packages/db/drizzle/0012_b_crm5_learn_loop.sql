CREATE TABLE "lead_weight_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"profile_hash" text NOT NULL,
	"evidence_hash" text NOT NULL,
	"multipliers" jsonb NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_scores" ADD COLUMN "weight_state_id" uuid;--> statement-breakpoint
ALTER TABLE "lead_weight_states" ADD CONSTRAINT "lead_weight_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_weight_states_tenant_profile_evidence_idx" ON "lead_weight_states" USING btree ("tenant_id","profile_hash","evidence_hash");--> statement-breakpoint
CREATE INDEX "lead_weight_states_tenant_profile_computed_idx" ON "lead_weight_states" USING btree ("tenant_id","profile_hash","computed_at");--> statement-breakpoint
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_weight_state_id_lead_weight_states_id_fk" FOREIGN KEY ("weight_state_id") REFERENCES "public"."lead_weight_states"("id") ON DELETE no action ON UPDATE no action;