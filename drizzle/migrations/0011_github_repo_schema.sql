CREATE TYPE "public"."pr_suggestion_status" AS ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'FAILED');--> statement-breakpoint
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
);
--> statement-breakpoint
ALTER TABLE "github_repo_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pr_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_suggestion_id" uuid,
	"email_metadata_id" uuid,
	"github_repo_link_id" uuid NOT NULL,
	"suggested_title" text NOT NULL,
	"suggested_body" text NOT NULL,
	"suggested_branch" text,
	"suggested_base_branch" text DEFAULT 'main',
	"suggested_labels" text[] DEFAULT '{}',
	"suggested_assignees" text[] DEFAULT '{}',
	"confidence" numeric(3, 2) NOT NULL,
	"reasoning" text,
	"status" "pr_suggestion_status" DEFAULT 'DRAFT' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_pr_number" integer,
	"created_pr_url" text,
	"error_message" text,
	"ai_model_version" text,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "pr_suggestions_confidence_range" CHECK (confidence >= 0 AND confidence <= 1)
);
--> statement-breakpoint
ALTER TABLE "pr_suggestions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "github_repo_links" ADD CONSTRAINT "github_repo_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repo_links" ADD CONSTRAINT "github_repo_links_oauth_connection_id_fkey" FOREIGN KEY ("oauth_connection_id") REFERENCES "public"."oauth_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repo_links" ADD CONSTRAINT "github_repo_links_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_suggestions" ADD CONSTRAINT "pr_suggestions_task_suggestion_id_fkey" FOREIGN KEY ("task_suggestion_id") REFERENCES "public"."task_suggestions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_suggestions" ADD CONSTRAINT "pr_suggestions_email_metadata_id_fkey" FOREIGN KEY ("email_metadata_id") REFERENCES "public"."email_metadata"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_suggestions" ADD CONSTRAINT "pr_suggestions_github_repo_link_id_fkey" FOREIGN KEY ("github_repo_link_id") REFERENCES "public"."github_repo_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_suggestions" ADD CONSTRAINT "pr_suggestions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_github_repo_links_project" ON "github_repo_links" USING btree ("project_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_github_repo_links_repo" ON "github_repo_links" USING btree ("repo_full_name" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_github_repo_links_oauth" ON "github_repo_links" USING btree ("oauth_connection_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_pr_suggestions_pending" ON "pr_suggestions" USING btree ("status") WHERE (deleted_at IS NULL AND status IN ('DRAFT', 'PENDING'));--> statement-breakpoint
CREATE INDEX "idx_pr_suggestions_repo" ON "pr_suggestions" USING btree ("github_repo_link_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_pr_suggestions_task" ON "pr_suggestions" USING btree ("task_suggestion_id" uuid_ops) WHERE (deleted_at IS NULL AND task_suggestion_id IS NOT NULL);--> statement-breakpoint
CREATE POLICY "Admins manage github repo links" ON "github_repo_links" AS PERMISSIVE FOR ALL TO public USING (is_admin());--> statement-breakpoint
CREATE POLICY "Users view repo links for accessible projects" ON "github_repo_links" AS PERMISSIVE FOR SELECT TO public USING ((
        project_id IN (
          SELECT id FROM projects WHERE deleted_at IS NULL
          AND (created_by = auth.uid() OR client_id IN (
            SELECT client_id FROM client_members WHERE user_id = auth.uid() AND deleted_at IS NULL
          ))
        )
      ));--> statement-breakpoint
CREATE POLICY "Admins manage pr suggestions" ON "pr_suggestions" AS PERMISSIVE FOR ALL TO public USING (is_admin());