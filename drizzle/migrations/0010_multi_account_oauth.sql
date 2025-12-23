ALTER TABLE "oauth_connections" DROP CONSTRAINT "oauth_connections_user_provider_key";--> statement-breakpoint
ALTER TABLE "oauth_connections" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "oauth_connections" ADD CONSTRAINT "oauth_connections_user_provider_account_key" UNIQUE("user_id","provider","provider_account_id");