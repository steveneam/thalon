ALTER TABLE "tenant_entitlements" DROP CONSTRAINT "tenant_entitlements_feature_check";--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "outreach" jsonb;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "social" jsonb;--> statement-breakpoint
ALTER TABLE "tenant_entitlements" ADD CONSTRAINT "tenant_entitlements_feature_check" CHECK (feature in ('sites_templates', 'crm', 'social_publishing'));