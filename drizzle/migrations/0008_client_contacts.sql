CREATE TYPE "public"."email_link_source" AS ENUM('AUTOMATIC', 'MANUAL_FORWARD', 'MANUAL_LINK');--> statement-breakpoint
CREATE TABLE "client_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "client_contacts_client_email_key" UNIQUE("client_id","email")
);
--> statement-breakpoint
ALTER TABLE "client_contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_metadata_id" uuid NOT NULL,
	"client_id" uuid,
	"project_id" uuid,
	"source" "email_link_source" NOT NULL,
	"confidence" numeric(3, 2),
	"linked_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "email_links_client_or_project" CHECK (client_id IS NOT NULL OR project_id IS NOT NULL),
	CONSTRAINT "email_links_confidence_range" CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);
--> statement-breakpoint
ALTER TABLE "email_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"gmail_message_id" text NOT NULL,
	"gmail_thread_id" text,
	"subject" text,
	"snippet" text,
	"from_email" text NOT NULL,
	"from_name" text,
	"to_emails" text[] DEFAULT '{}' NOT NULL,
	"cc_emails" text[] DEFAULT '{}' NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"has_attachments" boolean DEFAULT false NOT NULL,
	"labels" text[] DEFAULT '{}' NOT NULL,
	"raw_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "email_metadata_user_gmail_id_key" UNIQUE("user_id","gmail_message_id")
);
--> statement-breakpoint
ALTER TABLE "email_metadata" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_links" ADD CONSTRAINT "email_links_email_metadata_id_fkey" FOREIGN KEY ("email_metadata_id") REFERENCES "public"."email_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_links" ADD CONSTRAINT "email_links_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_links" ADD CONSTRAINT "email_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_links" ADD CONSTRAINT "email_links_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_metadata" ADD CONSTRAINT "email_metadata_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_client_contacts_client" ON "client_contacts" USING btree ("client_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_client_contacts_email" ON "client_contacts" USING btree ("email" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_client_contacts_email_domain" ON "client_contacts" USING btree (split_part(email, '@', 2)) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_email_links_email" ON "email_links" USING btree ("email_metadata_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_email_links_client" ON "email_links" USING btree ("client_id" uuid_ops) WHERE (deleted_at IS NULL AND client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_email_links_project" ON "email_links" USING btree ("project_id" uuid_ops) WHERE (deleted_at IS NULL AND project_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_email_metadata_user" ON "email_metadata" USING btree ("user_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_email_metadata_from_email" ON "email_metadata" USING btree ("from_email" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_email_metadata_received_at" ON "email_metadata" USING btree ("received_at" DESC NULLS FIRST) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_email_metadata_thread" ON "email_metadata" USING btree ("gmail_thread_id" text_ops) WHERE (deleted_at IS NULL AND gmail_thread_id IS NOT NULL);--> statement-breakpoint
CREATE POLICY "Admins manage client contacts" ON "client_contacts" AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());--> statement-breakpoint
CREATE POLICY "Users view client contacts for accessible clients" ON "client_contacts" AS PERMISSIVE FOR SELECT TO public USING ((
        client_id IN (
          SELECT client_id FROM client_members
          WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
      ));--> statement-breakpoint
CREATE POLICY "Admins manage email links" ON "email_links" AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());--> statement-breakpoint
CREATE POLICY "Users view linked emails for accessible clients" ON "email_links" AS PERMISSIVE FOR SELECT TO public USING ((
        client_id IN (
          SELECT client_id FROM client_members
          WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
        OR project_id IN (
          SELECT id FROM projects
          WHERE created_by = auth.uid() AND deleted_at IS NULL
        )
      ));--> statement-breakpoint
CREATE POLICY "Users manage own email metadata" ON "email_metadata" AS PERMISSIVE FOR ALL TO public USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "Admins view all email metadata" ON "email_metadata" AS PERMISSIVE FOR SELECT TO public USING (is_admin());