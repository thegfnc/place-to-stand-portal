CREATE TYPE "public"."lead_source_type" AS ENUM('REFERRAL', 'WEBSITE', 'EVENT');--> statement-breakpoint
ALTER TABLE "leads" RENAME COLUMN "name" TO "contact_name";--> statement-breakpoint
ALTER TABLE "leads" RENAME COLUMN "source" TO "source_type";--> statement-breakpoint
ALTER TABLE "leads" RENAME COLUMN "owner_id" TO "assignee_id";--> statement-breakpoint
ALTER TABLE "leads" DROP CONSTRAINT "leads_owner_id_fkey";
--> statement-breakpoint
DROP INDEX "idx_leads_owner";--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "source_detail" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "company_name" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "company_website" text;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_leads_assignee" ON "leads" USING btree ("assignee_id" uuid_ops) WHERE (deleted_at IS NULL);