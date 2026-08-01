ALTER TABLE "social_publications" DROP CONSTRAINT "social_publications_platform_check";--> statement-breakpoint
ALTER TABLE "social_publications" ADD CONSTRAINT "social_publications_platform_check" CHECK (platform in ('linkedin', 'x', 'facebook', 'instagram', 'tiktok', 'reddit', 'bluesky', 'youtube'));--> statement-breakpoint
ALTER TABLE "publication_metrics" DROP CONSTRAINT "publication_metrics_platform_check";--> statement-breakpoint
ALTER TABLE "publication_metrics" ADD CONSTRAINT "publication_metrics_platform_check" CHECK (platform in ('linkedin', 'x', 'facebook', 'instagram', 'tiktok', 'reddit', 'bluesky', 'youtube'));
