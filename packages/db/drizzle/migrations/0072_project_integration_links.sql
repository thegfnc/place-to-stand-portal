CREATE TYPE "public"."integration_provider" AS ENUM('VERCEL', 'SUPABASE');--> statement-breakpoint
ALTER TYPE "public"."oauth_provider" ADD VALUE 'VERCEL';--> statement-breakpoint
ALTER TYPE "public"."oauth_provider" ADD VALUE 'SUPABASE';--> statement-breakpoint
CREATE TABLE "project_integration_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"external_id" text NOT NULL,
	"external_name" text NOT NULL,
	"owner_id" text,
	"owner_slug" text,
	"owner_name" text,
	"url" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"linked_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "project_integration_links_project_provider_external_key" UNIQUE("project_id","provider","external_id")
);
--> statement-breakpoint
ALTER TABLE "project_integration_links" ADD CONSTRAINT "project_integration_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_integration_links" ADD CONSTRAINT "project_integration_links_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_project_integration_links_project" ON "project_integration_links" USING btree ("project_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_project_integration_links_external" ON "project_integration_links" USING btree ("provider","external_id" text_ops) WHERE (deleted_at IS NULL);