CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"fanout_run_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"format" text,
	"body" text NOT NULL,
	"body_hash" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'generated' NOT NULL,
	"generation_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drafts_generation_key_unique" UNIQUE("generation_key"),
	CONSTRAINT "drafts_status_check" CHECK (status in ('generated', 'judging', 'queued', 'approved', 'scheduled', 'published', 'blocked', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "fanout_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"brand_profile_id" uuid NOT NULL,
	"brand_profile_version" integer NOT NULL,
	"platforms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prompt_version" text NOT NULL,
	"model" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generation_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fanout_runs_generation_key_unique" UNIQUE("generation_key"),
	CONSTRAINT "fanout_runs_status_check" CHECK (status in ('pending', 'running', 'complete', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "source_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(1536),
	"token_count" integer,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"uri" text,
	"raw_ref" text,
	"content_hash" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_kind_check" CHECK (kind in ('url', 'prompt', 'doc', 'feature'))
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"edited_body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approvals_action_check" CHECK (action in ('approve', 'reject', 'edit'))
);
--> statement-breakpoint
CREATE TABLE "edit_diffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"approval_id" uuid NOT NULL,
	"before_hash" text NOT NULL,
	"after_hash" text NOT NULL,
	"diff" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"input" jsonb NOT NULL,
	"expected" jsonb NOT NULL,
	"origin" text NOT NULL,
	"source_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eval_cases_origin_check" CHECK (origin in ('edit_diff', 'golden', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "judge_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"gate" text NOT NULL,
	"verdict" text NOT NULL,
	"body_hash" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"model" text,
	"prompt_version" text,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "judge_results_verdict_check" CHECK (verdict in ('pass', 'fail'))
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_seq_unique" UNIQUE("seq")
);
--> statement-breakpoint
CREATE TABLE "llm_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"value_ref" text NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_hit_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "publish_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"scheduled_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publish_queue_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "publish_queue_status_check" CHECK (status in ('pending', 'processing', 'published', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "retrieval_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"result" jsonb NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_hit_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "usage_ledger" (
	"tenant_id" uuid NOT NULL,
	"day" date NOT NULL,
	"model" text NOT NULL,
	"tokens_in" bigint DEFAULT 0 NOT NULL,
	"tokens_out" bigint DEFAULT 0 NOT NULL,
	"cost_estimate" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_ledger_tenant_id_day_model_pk" PRIMARY KEY("tenant_id","day","model")
);
--> statement-breakpoint
CREATE TABLE "brand_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"voice" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"denylist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"platform_profiles" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tenants_status_check" CHECK (status in ('active', 'suspended'))
);
--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_fanout_run_id_fanout_runs_id_fk" FOREIGN KEY ("fanout_run_id") REFERENCES "public"."fanout_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fanout_runs" ADD CONSTRAINT "fanout_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fanout_runs" ADD CONSTRAINT "fanout_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fanout_runs" ADD CONSTRAINT "fanout_runs_brand_profile_id_brand_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."brand_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_chunks" ADD CONSTRAINT "source_chunks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_chunks" ADD CONSTRAINT "source_chunks_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_diffs" ADD CONSTRAINT "edit_diffs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_diffs" ADD CONSTRAINT "edit_diffs_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_diffs" ADD CONSTRAINT "edit_diffs_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_cases" ADD CONSTRAINT "eval_cases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_results" ADD CONSTRAINT "judge_results_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_results" ADD CONSTRAINT "judge_results_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_cache" ADD CONSTRAINT "llm_cache_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_queue" ADD CONSTRAINT "publish_queue_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_queue" ADD CONSTRAINT "publish_queue_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_cache" ADD CONSTRAINT "retrieval_cache_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drafts_tenant_status_idx" ON "drafts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "drafts_tenant_created_idx" ON "drafts" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "fanout_runs_tenant_created_idx" ON "fanout_runs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "source_chunks_source_seq_idx" ON "source_chunks" USING btree ("source_id","seq");--> statement-breakpoint
CREATE INDEX "source_chunks_embedding_hnsw_idx" ON "source_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "sources_tenant_created_idx" ON "sources" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "approvals_tenant_created_idx" ON "approvals" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "edit_diffs_tenant_created_idx" ON "edit_diffs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "eval_cases_tenant_created_idx" ON "eval_cases" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "judge_results_draft_hash_idx" ON "judge_results" USING btree ("draft_id","body_hash");--> statement-breakpoint
CREATE INDEX "events_tenant_created_idx" ON "events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "events_entity_idx" ON "events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "publish_queue_tenant_platform_scheduled_idx" ON "publish_queue" USING btree ("tenant_id","platform","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_profiles_tenant_version_idx" ON "brand_profiles" USING btree ("tenant_id","version");--> statement-breakpoint
CREATE INDEX "brand_profiles_tenant_active_idx" ON "brand_profiles" USING btree ("tenant_id","active");