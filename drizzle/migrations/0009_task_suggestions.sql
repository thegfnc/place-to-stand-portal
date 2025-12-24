CREATE TYPE "public"."suggestion_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'MODIFIED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "suggestion_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_suggestion_id" uuid NOT NULL,
	"feedback_type" text NOT NULL,
	"original_value" text,
	"corrected_value" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suggestion_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_metadata_id" uuid NOT NULL,
	"project_id" uuid,
	"suggested_title" text NOT NULL,
	"suggested_description" text,
	"suggested_due_date" date,
	"suggested_priority" text,
	"suggested_assignees" uuid[] DEFAULT '{}',
	"confidence" numeric(3, 2) NOT NULL,
	"reasoning" text,
	"status" "suggestion_status" DEFAULT 'PENDING' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_task_id" uuid,
	"ai_model_version" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "task_suggestions_confidence_range" CHECK (confidence >= 0 AND confidence <= 1)
);
--> statement-breakpoint
ALTER TABLE "task_suggestions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suggestion_feedback" ADD CONSTRAINT "suggestion_feedback_task_suggestion_id_fkey" FOREIGN KEY ("task_suggestion_id") REFERENCES "public"."task_suggestions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion_feedback" ADD CONSTRAINT "suggestion_feedback_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_suggestions" ADD CONSTRAINT "task_suggestions_email_metadata_id_fkey" FOREIGN KEY ("email_metadata_id") REFERENCES "public"."email_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_suggestions" ADD CONSTRAINT "task_suggestions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_suggestions" ADD CONSTRAINT "task_suggestions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_suggestions" ADD CONSTRAINT "task_suggestions_created_task_id_fkey" FOREIGN KEY ("created_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_suggestion_feedback_suggestion" ON "suggestion_feedback" USING btree ("task_suggestion_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_task_suggestions_pending" ON "task_suggestions" USING btree ("status") WHERE (deleted_at IS NULL AND status = 'PENDING');--> statement-breakpoint
CREATE INDEX "idx_task_suggestions_email" ON "task_suggestions" USING btree ("email_metadata_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_task_suggestions_project" ON "task_suggestions" USING btree ("project_id" uuid_ops) WHERE (deleted_at IS NULL AND project_id IS NOT NULL);--> statement-breakpoint
CREATE POLICY "Admins manage suggestion feedback" ON "suggestion_feedback" AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());--> statement-breakpoint
CREATE POLICY "Users view own suggestion feedback" ON "suggestion_feedback" AS PERMISSIVE FOR SELECT TO public USING (created_by = auth.uid());--> statement-breakpoint
CREATE POLICY "Admins manage task suggestions" ON "task_suggestions" AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());--> statement-breakpoint
CREATE POLICY "Users view own task suggestions" ON "task_suggestions" AS PERMISSIVE FOR SELECT TO public USING ((
        email_metadata_id IN (
          SELECT id FROM email_metadata WHERE user_id = auth.uid()
        )
      ));