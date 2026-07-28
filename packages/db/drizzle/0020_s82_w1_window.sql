ALTER TABLE "publish_queue" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "publish_queue" ADD COLUMN "last_error" text;