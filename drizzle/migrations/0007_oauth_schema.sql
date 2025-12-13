CREATE TYPE "public"."oauth_connection_status" AS ENUM('ACTIVE', 'EXPIRED', 'REVOKED', 'PENDING_REAUTH');--> statement-breakpoint
CREATE TYPE "public"."oauth_provider" AS ENUM('GOOGLE', 'GITHUB');--> statement-breakpoint
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
	"provider_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "oauth_connections_user_provider_key" UNIQUE("user_id","provider")
);
--> statement-breakpoint
ALTER TABLE "oauth_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oauth_connections" ADD CONSTRAINT "oauth_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_oauth_connections_user" ON "oauth_connections" USING btree ("user_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_oauth_connections_provider" ON "oauth_connections" USING btree ("provider") WHERE (deleted_at IS NULL AND status = 'ACTIVE');--> statement-breakpoint
CREATE POLICY "Users manage own oauth connections" ON "oauth_connections" AS PERMISSIVE FOR ALL TO public USING (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "Admins view all oauth connections" ON "oauth_connections" AS PERMISSIVE FOR SELECT TO public USING (is_admin());