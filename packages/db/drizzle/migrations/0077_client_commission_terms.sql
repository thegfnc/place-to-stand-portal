CREATE TABLE "client_commission_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"closer_user_id" uuid,
	"origination_user_id" uuid,
	"origination_contact_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_client_commission_terms_month_start" CHECK (effective_from = date_trunc('month', effective_from)::date),
	CONSTRAINT "chk_client_commission_terms_origination_mutex" CHECK (NOT (origination_user_id IS NOT NULL AND origination_contact_id IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "client_commission_terms" ADD CONSTRAINT "client_commission_terms_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_commission_terms" ADD CONSTRAINT "client_commission_terms_closer_user_id_fkey" FOREIGN KEY ("closer_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_commission_terms" ADD CONSTRAINT "client_commission_terms_origination_user_id_fkey" FOREIGN KEY ("origination_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_commission_terms" ADD CONSTRAINT "client_commission_terms_origination_contact_id_fkey" FOREIGN KEY ("origination_contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_commission_terms" ADD CONSTRAINT "client_commission_terms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_client_commission_terms_client_effective" ON "client_commission_terms" USING btree ("client_id","effective_from") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_client_commission_terms_resolution" ON "client_commission_terms" USING btree ("client_id","effective_from" DESC NULLS LAST) WHERE (deleted_at IS NULL);--> statement-breakpoint
-- Backfill: one term per existing client — including soft-deleted clients —
-- at the same sentinel client_billing_terms used (predates all data), copying
-- the live closer/origination columns so every historical month resolves to
-- exactly what it rendered before this migration (no close-snapshot drift).
INSERT INTO "client_commission_terms" ("client_id", "effective_from", "closer_user_id", "origination_user_id", "origination_contact_id")
SELECT "id", DATE '2000-01-01', "closer_user_id", "origination_user_id", "origination_contact_id"
FROM "clients";
