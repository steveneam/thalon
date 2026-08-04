ALTER TABLE "saved_views" DROP CONSTRAINT "saved_views_surface_check";--> statement-breakpoint
UPDATE "saved_views" SET "surface" = 'schedule' WHERE "surface" = 'calendar';--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_surface_check" CHECK (surface in ('leads', 'schedule'));
