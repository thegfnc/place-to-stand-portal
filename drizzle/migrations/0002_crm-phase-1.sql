CREATE TYPE "public"."client_billing_type" AS ENUM('prepaid', 'net_30');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('NEW_OPPORTUNITIES', 'ACTIVE_OPPORTUNITIES', 'PROPOSAL_SENT', 'ON_ICE', 'CLOSED_WON', 'CLOSED_LOST');--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "lead_status" DEFAULT 'NEW_OPPORTUNITIES' NOT NULL,
	"source" text,
	"owner_id" uuid,
	"contact_email" text,
	"contact_phone" text,
	"notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "task_assignee_metadata" (
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "task_assignee_metadata_pkey" PRIMARY KEY("task_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "client_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "billing_type" "client_billing_type" DEFAULT 'prepaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "is_personal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "is_internal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignee_metadata" ADD CONSTRAINT "task_assignee_metadata_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignee_metadata" ADD CONSTRAINT "task_assignee_metadata_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_leads_status" ON "leads" USING btree ("status" enum_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_leads_owner" ON "leads" USING btree ("owner_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_task_assignee_metadata_user" ON "task_assignee_metadata" USING btree ("user_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_personal_internal_client_check" CHECK ((
        (
          (is_personal OR is_internal)
          AND client_id IS NULL
        )
        OR (
          (NOT is_personal AND NOT is_internal)
          AND client_id IS NOT NULL
        )
      ));--> statement-breakpoint
CREATE POLICY "Admins manage leads" ON "leads" AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());--> statement-breakpoint
CREATE POLICY "Users view leads" ON "leads" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Admins manage task assignee metadata" ON "task_assignee_metadata" AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());--> statement-breakpoint
CREATE POLICY "Users view task assignee metadata" ON "task_assignee_metadata" AS PERMISSIVE FOR SELECT TO public;
