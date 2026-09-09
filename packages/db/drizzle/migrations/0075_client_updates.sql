CREATE TYPE "public"."client_update_status" AS ENUM('DRAFT', 'SENT');--> statement-breakpoint
CREATE TABLE "client_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"status" "client_update_status" DEFAULT 'DRAFT' NOT NULL,
	"subject" text NOT NULL,
	"intro" text DEFAULT '' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"closing" text DEFAULT '' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"recipients" jsonb DEFAULT '{"to":[],"cc":[]}'::jsonb NOT NULL,
	"created_by_id" uuid NOT NULL,
	"sent_by_id" uuid,
	"sent_at" timestamp with time zone,
	"gmail_message_id" text,
	"gmail_thread_id" text,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "client_updates" ADD CONSTRAINT "client_updates_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_updates" ADD CONSTRAINT "client_updates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_updates" ADD CONSTRAINT "client_updates_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_client_updates_client_created" ON "client_updates" USING btree ("client_id" uuid_ops,"created_at" timestamptz_ops) WHERE (deleted_at IS NULL);