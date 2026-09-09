DROP INDEX "idx_activity_logs_actor_id";--> statement-breakpoint
DROP INDEX "idx_activity_logs_client";--> statement-breakpoint
DROP INDEX "idx_activity_logs_project";--> statement-breakpoint
DROP INDEX "idx_activity_logs_target";--> statement-breakpoint
-- The cache is transient (one-hour TTL) and older rows hold plain markdown
-- rather than JSON, so clear it before changing the column type.
DELETE FROM "activity_overview_cache";--> statement-breakpoint
ALTER TABLE "activity_overview_cache" ALTER COLUMN "summary" SET DATA TYPE jsonb USING "summary"::jsonb;--> statement-breakpoint
CREATE INDEX "idx_activity_logs_type_created_at" ON "activity_logs" USING btree ("target_type" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_activity_logs_project" ON "activity_logs" USING btree ("target_project_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_activity_logs_target" ON "activity_logs" USING btree ("target_type" text_ops,"target_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "activity_logs" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "activity_logs" DROP COLUMN "deleted_at";--> statement-breakpoint
ALTER TABLE "activity_logs" DROP COLUMN "restored_at";--> statement-breakpoint
-- Page views were logged as activity until Sep 2026 (about half the table) and
-- had no consumer; the writers were removed in #196 and the rows hidden from
-- every feed. Purge them now that nothing reads them.
DELETE FROM "activity_logs" WHERE "verb" IN ('PROJECT_VIEWED', 'CLIENT_VIEWED');