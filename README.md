# place-to-stand-portal

- Supabase storage expects a private `user-avatars` bucket. Create it once with authenticated access before enabling avatar uploads in the portal.

## Lead intake webhook

- Incoming marketing-site leads should be POSTed to `/api/integrations/leads-intake` with a `Bearer` token that matches `LEADS_INTAKE_TOKEN`.
- Generate a token with `openssl rand -hex 32` (or a similar secret generator) and store it both in this app (`LEADS_INTAKE_TOKEN`) and the marketing site (`PORTAL_LEADS_TOKEN`).
- Requests must provide JSON in the shape `{ name, email, company?, website?, message?, sourceDetail? }`. Records are inserted into the `NEW_OPPORTUNITIES` column with a `WEBSITE` source and appear on `/leads/board` immediately.

## Local Docker Development

### Prerequisites
- Docker and Docker Compose installed
- Copy `.env.example` to `.env` and fill in required values

### Quick Start

```bash
# Start all services (PostgreSQL + Next.js app)
docker compose up -d

# View logs
docker compose logs -f app

# Stop services
docker compose down
```

The application will be available at http://localhost:3000

### Services

| Service | Port | Description |
|---------|------|-------------|
| `app` | 3000 | Next.js application |
| `db` | 54322 | PostgreSQL database |

### Environment Variables

The Docker setup reads from your `.env` file. Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL (or `http://host.docker.internal:54321` for local Supabase)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `OAUTH_TOKEN_ENCRYPTION_KEY` - Base64-encoded encryption key (32+ chars)

Optional (for full functionality):
- `RESEND_API_KEY`, `RESEND_AUDIENCE_ID` - Email service
- `NEXT_PUBLIC_POSTHOG_KEY` - Analytics
- `AI_GATEWAY_API_KEY` - AI features

### Using with Supabase Local

If you're running Supabase locally via `supabase start`, the Docker app can connect to it:

```bash
# Start Supabase local stack first
supabase start

# Then start the Docker services
docker compose up -d
```

The app uses `host.docker.internal` to reach services on your host machine.

### Development Workflow

```bash
# Rebuild after dependency changes
docker compose build app

# Run database migrations
docker compose exec app npm run db:migrate

# Access the app container shell
docker compose exec app sh
```

### Production Build

```bash
# Build production image
docker build --target production -t pts-portal .

# Run production container
docker run -p 3000:3000 --env-file .env pts-portal
```

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
