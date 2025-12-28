-- =============================================================================
-- 0007_unified_messaging.sql
-- Consolidated migration for Phase 5: Threads, Messages & Unified Suggestions
-- Replaces: 0007_oauth_schema, 0008_client_contacts, 0009_task_suggestions,
--           0010_multi_account_oauth, 0011_github_repo_schema
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------

CREATE TYPE "public"."oauth_provider" AS ENUM('GOOGLE', 'GITHUB');--> statement-breakpoint
CREATE TYPE "public"."oauth_connection_status" AS ENUM('ACTIVE', 'EXPIRED', 'REVOKED', 'PENDING_REAUTH');--> statement-breakpoint
CREATE TYPE "public"."message_source" AS ENUM('EMAIL', 'CHAT', 'VOICE_MEMO', 'DOCUMENT', 'FORM');--> statement-breakpoint
CREATE TYPE "public"."thread_status" AS ENUM('OPEN', 'RESOLVED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."suggestion_type" AS ENUM('TASK', 'PR', 'REPLY');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'MODIFIED', 'EXPIRED', 'FAILED');--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- OAUTH CONNECTIONS (multi-account support)
-- -----------------------------------------------------------------------------

CREATE TABLE "oauth_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"provider_account_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"scopes" text[] NOT NULL,
	"status" "oauth_connection_status" DEFAULT 'ACTIVE' NOT NULL,
	"provider_email" text,
	"display_name" text,
	"provider_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "oauth_connections_user_provider_account_key" UNIQUE("user_id","provider","provider_account_id")
);--> statement-breakpoint
ALTER TABLE "oauth_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oauth_connections" ADD CONSTRAINT "oauth_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_oauth_connections_user" ON "oauth_connections" USING btree ("user_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_oauth_connections_provider" ON "oauth_connections" USING btree ("provider") WHERE (deleted_at IS NULL AND status = 'ACTIVE');--> statement-breakpoint
CREATE POLICY "Users manage own oauth connections" ON "oauth_connections" AS PERMISSIVE FOR ALL TO public USING (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "Admins view all oauth connections" ON "oauth_connections" AS PERMISSIVE FOR SELECT TO public USING (is_admin());--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- CLIENT CONTACTS
-- -----------------------------------------------------------------------------

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
);--> statement-breakpoint
ALTER TABLE "client_contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_client_contacts_client" ON "client_contacts" USING btree ("client_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_client_contacts_email" ON "client_contacts" USING btree ("email" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_client_contacts_email_domain" ON "client_contacts" USING btree (split_part(email, '@', 2)) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE POLICY "Admins manage client contacts" ON "client_contacts" AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());--> statement-breakpoint
CREATE POLICY "Users view client contacts for accessible clients" ON "client_contacts" AS PERMISSIVE FOR SELECT TO public USING ((
	client_id IN (
		SELECT client_id FROM client_members
		WHERE user_id = auth.uid() AND deleted_at IS NULL
	)
));--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- THREADS (conversation containers)
-- -----------------------------------------------------------------------------

CREATE TABLE "threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"project_id" uuid,
	"subject" text,
	"status" "thread_status" DEFAULT 'OPEN' NOT NULL,
	"source" "message_source" NOT NULL,
	"external_thread_id" text,
	"participant_emails" text[] DEFAULT '{}' NOT NULL,
	"last_message_at" timestamp with time zone,
	"message_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_threads_client" ON "threads" USING btree ("client_id" uuid_ops) WHERE (deleted_at IS NULL AND client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_threads_project" ON "threads" USING btree ("project_id" uuid_ops) WHERE (deleted_at IS NULL AND project_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_threads_external" ON "threads" USING btree ("external_thread_id" text_ops) WHERE (deleted_at IS NULL AND external_thread_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_threads_last_message" ON "threads" USING btree ("last_message_at" DESC NULLS FIRST) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE POLICY "Admins manage threads" ON "threads" AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());--> statement-breakpoint
CREATE POLICY "Users view accessible threads" ON "threads" AS PERMISSIVE FOR SELECT TO public USING ((
	client_id IN (
		SELECT client_id FROM client_members
		WHERE user_id = auth.uid() AND deleted_at IS NULL
	)
	OR project_id IN (
		SELECT id FROM projects
		WHERE created_by = auth.uid() AND deleted_at IS NULL
	)
	OR created_by = auth.uid()
));--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- MESSAGES (individual messages within threads)
-- -----------------------------------------------------------------------------

CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "message_source" NOT NULL,
	"external_message_id" text,
	"subject" text,
	"body_text" text,
	"body_html" text,
	"snippet" text,
	"from_email" text NOT NULL,
	"from_name" text,
	"to_emails" text[] DEFAULT '{}' NOT NULL,
	"cc_emails" text[] DEFAULT '{}' NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"is_inbound" boolean DEFAULT true NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"has_attachments" boolean DEFAULT false NOT NULL,
	"analyzed_at" timestamp with time zone,
	"analysis_version" text,
	"provider_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "messages_user_external_key" UNIQUE("user_id","external_message_id")
);--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_messages_thread" ON "messages" USING btree ("thread_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_messages_user" ON "messages" USING btree ("user_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_messages_sent_at" ON "messages" USING btree ("sent_at" DESC NULLS FIRST) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_messages_unanalyzed" ON "messages" USING btree ("user_id" uuid_ops) WHERE (deleted_at IS NULL AND analyzed_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_messages_from_email" ON "messages" USING btree ("from_email" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE POLICY "Users manage own messages" ON "messages" AS PERMISSIVE FOR ALL TO public USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "Admins view all messages" ON "messages" AS PERMISSIVE FOR SELECT TO public USING (is_admin());--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- MESSAGE ATTACHMENTS
-- -----------------------------------------------------------------------------

CREATE TABLE "message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" bigint NOT NULL,
	"content_id" text,
	"is_inline" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_message_attachments_message" ON "message_attachments" USING btree ("message_id" uuid_ops);--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- EMAIL RAW (RFC822 storage for compliance/archival)
-- -----------------------------------------------------------------------------

CREATE TABLE "email_raw" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"raw_mime" text,
	"storage_path" text,
	"checksum" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	CONSTRAINT "email_raw_message_key" UNIQUE("message_id"),
	CONSTRAINT "email_raw_has_content" CHECK (raw_mime IS NOT NULL OR storage_path IS NOT NULL)
);--> statement-breakpoint
ALTER TABLE "email_raw" ADD CONSTRAINT "email_raw_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- GITHUB REPO LINKS
-- -----------------------------------------------------------------------------

CREATE TABLE "github_repo_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"oauth_connection_id" uuid NOT NULL,
	"repo_owner" text NOT NULL,
	"repo_name" text NOT NULL,
	"repo_full_name" text NOT NULL,
	"repo_id" bigint NOT NULL,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"linked_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "github_repo_links_project_repo_key" UNIQUE("project_id","repo_full_name")
);--> statement-breakpoint
ALTER TABLE "github_repo_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "github_repo_links" ADD CONSTRAINT "github_repo_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repo_links" ADD CONSTRAINT "github_repo_links_oauth_connection_id_fkey" FOREIGN KEY ("oauth_connection_id") REFERENCES "public"."oauth_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repo_links" ADD CONSTRAINT "github_repo_links_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_github_repo_links_project" ON "github_repo_links" USING btree ("project_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_github_repo_links_repo" ON "github_repo_links" USING btree ("repo_full_name" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_github_repo_links_oauth" ON "github_repo_links" USING btree ("oauth_connection_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE POLICY "Admins manage github repo links" ON "github_repo_links" AS PERMISSIVE FOR ALL TO public USING (is_admin());--> statement-breakpoint
CREATE POLICY "Users view repo links for accessible projects" ON "github_repo_links" AS PERMISSIVE FOR SELECT TO public USING ((
	project_id IN (
		SELECT id FROM projects WHERE deleted_at IS NULL
		AND (created_by = auth.uid() OR client_id IN (
			SELECT client_id FROM client_members WHERE user_id = auth.uid() AND deleted_at IS NULL
		))
	)
));--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- SUGGESTIONS (unified polymorphic table)
-- -----------------------------------------------------------------------------

CREATE TABLE "suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid,
	"thread_id" uuid,
	"type" "suggestion_type" NOT NULL,
	"status" "suggestion_status" DEFAULT 'PENDING' NOT NULL,
	"project_id" uuid,
	"github_repo_link_id" uuid,
	"confidence" numeric(3, 2) NOT NULL,
	"reasoning" text,
	"ai_model_version" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"suggested_content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_task_id" uuid,
	"created_pr_number" integer,
	"created_pr_url" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "suggestions_confidence_range" CHECK (confidence >= 0 AND confidence <= 1),
	CONSTRAINT "suggestions_pr_requires_repo" CHECK (type != 'PR' OR github_repo_link_id IS NOT NULL)
);--> statement-breakpoint
ALTER TABLE "suggestions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_github_repo_link_id_fkey" FOREIGN KEY ("github_repo_link_id") REFERENCES "public"."github_repo_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_created_task_id_fkey" FOREIGN KEY ("created_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_suggestions_pending_type" ON "suggestions" USING btree ("type", "status") WHERE (deleted_at IS NULL AND status IN ('PENDING', 'DRAFT'));--> statement-breakpoint
CREATE INDEX "idx_suggestions_message" ON "suggestions" USING btree ("message_id" uuid_ops) WHERE (deleted_at IS NULL AND message_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_suggestions_thread" ON "suggestions" USING btree ("thread_id" uuid_ops) WHERE (deleted_at IS NULL AND thread_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_suggestions_project" ON "suggestions" USING btree ("project_id" uuid_ops) WHERE (deleted_at IS NULL AND project_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_suggestions_repo" ON "suggestions" USING btree ("github_repo_link_id" uuid_ops) WHERE (deleted_at IS NULL AND github_repo_link_id IS NOT NULL);--> statement-breakpoint
CREATE POLICY "Admins manage suggestions" ON "suggestions" AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());--> statement-breakpoint
CREATE POLICY "Users view suggestions for accessible threads" ON "suggestions" AS PERMISSIVE FOR SELECT TO public USING ((
	thread_id IN (
		SELECT t.id FROM threads t
		WHERE t.deleted_at IS NULL AND (
			t.client_id IN (
				SELECT client_id FROM client_members
				WHERE user_id = auth.uid() AND deleted_at IS NULL
			)
			OR t.created_by = auth.uid()
		)
	)
	OR message_id IN (
		SELECT id FROM messages WHERE user_id = auth.uid()
	)
));--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- SUGGESTION FEEDBACK
-- -----------------------------------------------------------------------------

CREATE TABLE "suggestion_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"suggestion_id" uuid NOT NULL,
	"feedback_type" text NOT NULL,
	"original_value" text,
	"corrected_value" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);--> statement-breakpoint
ALTER TABLE "suggestion_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suggestion_feedback" ADD CONSTRAINT "suggestion_feedback_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "public"."suggestions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion_feedback" ADD CONSTRAINT "suggestion_feedback_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_suggestion_feedback_suggestion" ON "suggestion_feedback" USING btree ("suggestion_id" uuid_ops);--> statement-breakpoint
CREATE POLICY "Admins manage suggestion feedback" ON "suggestion_feedback" AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());--> statement-breakpoint
CREATE POLICY "Users view own suggestion feedback" ON "suggestion_feedback" AS PERMISSIVE FOR SELECT TO public USING (created_by = auth.uid());--> statement-breakpoint
CREATE POLICY "Users create own suggestion feedback" ON "suggestion_feedback" AS PERMISSIVE FOR INSERT TO public WITH CHECK (created_by = auth.uid());
