# place-to-stand-portal

- Supabase storage expects a private `user-avatars` bucket. Create it once with authenticated access before enabling avatar uploads in the portal.

## Database migrations

- The current schema lives in `lib/db/schema.ts` (with relations in `lib/db/relations.ts`). Keep these definitions in sync with the database.
- Existing Supabase migrations are captured in the baseline migration `drizzle/migrations/0000_supabase_baseline.sql` and the journal at `drizzle/meta/_journal.json`. Apply the baseline once (`npm run db:migrate`) after configuring `DATABASE_URL`; it will only register the existing state.
- Commands:
  - `npm run db:pull` – introspect the database into the schema file (use sparingly, only when the DB is the source of truth).
  - `npm run db:generate -- --name <change>` – create a SQL migration from schema edits.
  - `npm run db:migrate` – apply migrations using the configured `DATABASE_URL`.
- Typical change flow:
  1. Update the schema/relations files in code.
  2. Run `npm run db:generate -- --name descriptive_label`.
  3. Review the generated SQL under `drizzle/migrations/`.
  4. Run `npm run db:migrate` locally, then in staging/production via the same command once reviewed.
- Ensure `DATABASE_URL` is present in your shell (export it or prefix the command) before running any of the Drizzle scripts. Use the Docker Postgres connection string for local development.
