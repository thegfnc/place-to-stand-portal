-- Custom SQL migration file, put your code below! --

-- Close the PostgREST / GraphQL exposure of application tables.
--
-- This project runs without Row Level Security (see CLAUDE.md) and both apps
-- talk to Postgres exclusively through Drizzle as the `postgres` role. Hosted
-- Supabase, however, ships default privileges on `public` that hand every
-- table created by `postgres` to the API roles `anon` and `authenticated`.
-- Every table added by a Drizzle migration since the baseline therefore became
-- readable and writable through the Data API with the browser-public anon key.
--
-- 1. Strip the existing grants from the two API roles. `service_role` keeps
--    its grants: that key is server-only and Supabase's own services use it.
-- 2. Change the default privileges of the migrating role so tables, sequences
--    and functions created by future migrations are not granted again.
--
-- Nothing in either app depends on these grants, so this is safe to apply
-- locally, in staging and in production. Verify afterwards with the anon key:
--   curl -i "$SUPABASE_URL/rest/v1/oauth_connections?select=id&limit=1" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
-- which must answer 401 "permission denied", never 200.

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "public" FROM "anon", "authenticated";--> statement-breakpoint
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "public" FROM "anon", "authenticated";--> statement-breakpoint
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA "public" FROM "anon", "authenticated";--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON TABLES FROM "anon", "authenticated";--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON SEQUENCES FROM "anon", "authenticated";--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON FUNCTIONS FROM "anon", "authenticated";
