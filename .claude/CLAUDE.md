# Claude Code Rules for PTS Portal

## Database & Migration Conventions

### Local Development Setup

This project uses **Supabase** for managed PostgreSQL. For local development:

- **Supabase PostgreSQL:** `localhost:54322` (via `supabase start`)
- **Supabase Studio:** `http://localhost:54321`
- **Docker App (optional):** `localhost:3002` (if using Docker for the Next.js app)

### Migration Workflow

**ALWAYS test migrations locally before deploying to production.**

```bash
# 1. Make schema changes in lib/db/schema.ts

# 2. Generate the migration
npm run db:generate -- --name descriptive_name

# 3. Review the generated SQL in drizzle/migrations/

# 4. Apply to LOCAL Supabase database
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run db:migrate

# 5. Verify the migration worked (in psql or Supabase Studio)

# 6. If issues, reset local database
supabase db reset
```

### Migration File Naming

Migrations are numbered sequentially starting from `0000`. Current baseline is at `0006`. New migrations should follow:

- `0007_oauth_schema.sql`
- `0008_client_contacts.sql`
- `0009_email_metadata.sql`
- etc.

### Schema Patterns to Follow

When creating new tables, follow these established patterns from the existing schema:

#### 1. Standard Timestamp Columns
```typescript
createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
  .default(sql`timezone('utc'::text, now())`)
  .notNull(),
updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
  .default(sql`timezone('utc'::text, now())`)
  .notNull(),
deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
```

#### 2. Partial Indexes for Soft Delete
```typescript
index('idx_table_column')
  .using('btree', table.column.asc().nullsLast().op('uuid_ops'))
  .where(sql`(deleted_at IS NULL)`),
```

#### 3. RLS Policies (enable on all tables)
```typescript
pgPolicy('Admins manage tablename', {
  as: 'permissive',
  for: 'all',
  to: ['public'],
  using: sql`is_admin()`,
}),
```

#### 4. CHECK Constraints for Bounded Values
```typescript
// For confidence scores (0.00-1.00)
check(
  'table_confidence_range',
  sql`confidence >= 0 AND confidence <= 1`
),
```

#### 5. Foreign Key Conventions
- Use `onDelete('cascade')` for child tables that should be deleted with parent
- Use `onDelete('no action')` (default) when referencing lookup data or audit trails

### Testing Migrations

Each migration task in `docs/plans/tasks/` includes a testing checklist. At minimum verify:

1. Table structure: `\d table_name`
2. Indexes exist: `\di+ idx_table_*`
3. Constraints work (test with invalid data)
4. RLS policies active: `SELECT * FROM pg_policies WHERE tablename = 'table_name';`

### Rollback Strategy

If a migration fails:

```sql
-- Drop in reverse dependency order
DROP TABLE IF EXISTS child_table CASCADE;
DROP TABLE IF EXISTS parent_table CASCADE;
DROP TYPE IF EXISTS custom_enum;
```

Then delete the migration file from `drizzle/migrations/` and regenerate.

## Docker Commands

```bash
# Start app only (uses host's Supabase)
docker compose up -d app

# Start app with rebuild
docker compose up -d --build app

# View logs
docker compose logs -f app

# Stop all
docker compose down
```

## Environment Variables

Required for local development (in `env.local`):

- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase API URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `OAUTH_TOKEN_ENCRYPTION_KEY` - Base64 encoded, min 32 chars

## Project Structure Notes

- `lib/db/schema.ts` - All Drizzle table definitions
- `lib/db/relations.ts` - Drizzle relation definitions
- `drizzle/migrations/` - Generated SQL migrations
- `docs/plans/` - Implementation plans and task tracking
