# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production with Turbopack
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler checks (no emit)

### Database (Drizzle ORM)
Ensure `DATABASE_URL` is set in your environment before running these commands.

- `npm run db:pull` - Introspect database schema into schema file (use sparingly, only when DB is source of truth)
- `npm run db:generate -- --name <change>` - Generate SQL migration from schema edits
- `npm run db:migrate` - Apply migrations to database

**Migration workflow:**
1. Update schema files in `lib/db/schema.ts` and `lib/db/relations.ts`
2. Run `npm run db:generate -- --name descriptive_label`
3. Review generated SQL in `drizzle/migrations/`
4. Apply locally with `npm run db:migrate`, then in staging/production

The baseline migration (`drizzle/migrations/0000_supabase_baseline.sql`) captures existing Supabase schema. Run `npm run db:migrate` once after configuring `DATABASE_URL` to register existing state.

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 16 (App Router) with Turbopack
- **Database**: PostgreSQL via Supabase with Drizzle ORM
- **Auth**: Supabase Auth with session-based authentication
- **Storage**: Supabase Storage (buckets: `user-avatars`, `task-attachments`)
- **State**: React Server Components + TanStack React Query
- **Styling**: Tailwind CSS v4, Radix UI, shadcn/ui components
- **Analytics**: PostHog (client and server-side)
- **Email**: Resend

### Route Organization
```
app/
├── (auth)/           # Sign-in, password reset (unauthenticated)
├── (dashboard)/      # Protected routes
│   ├── clients/      # Client management (archive, activity)
│   ├── projects/     # Project boards (board, backlog, calendar, review, time-logs, archive, activity)
│   ├── leads/        # Lead kanban board
│   ├── my-tasks/     # User's assigned tasks
│   └── settings/     # Users, projects, hour blocks, integrations
├── api/              # API routes
│   ├── v1/           # Versioned endpoints
│   ├── my-tasks/     # Task management
│   ├── projects/     # Project operations
│   ├── uploads/      # File uploads
│   ├── storage/      # File serving
│   └── integrations/ # External webhooks (lead intake)
└── unauthorized/     # Access denied page
```

Routes use slug-based patterns: `/projects/[clientSlug]/[projectSlug]/board/[[...taskId]]/`

### Database Schema

**Core tables** (`lib/db/schema.ts`):
- `users` - User accounts with roles (ADMIN, CLIENT)
- `clients` - Client records with billing types (prepaid, net_30)
- `projects` - Projects with types: CLIENT (tied to clients), PERSONAL (individual), INTERNAL (team)
- `tasks` - Tasks with workflow: BACKLOG → ON_DECK → IN_PROGRESS → IN_REVIEW → BLOCKED → DONE → ARCHIVED
- `leads` - Lead pipeline: NEW_OPPORTUNITIES → ACTIVE → PROPOSAL_SENT → ON_ICE → CLOSED_WON/LOST/UNQUALIFIED
- `time_logs` + `time_log_tasks` - Time tracking linked to tasks/projects
- `hour_blocks` - Prepaid hour contracts
- `task_comments` - Task discussions
- `task_attachments` - File attachments
- `task_assignees` + `task_assignee_metadata` - Task assignments with custom sort order
- `client_members` - Client-to-user memberships
- `activity_logs` + `activity_overview_cache` - Activity audit trail

**Key patterns:**
- UUIDs for primary keys
- Soft deletes via `deletedAt` timestamps on all core tables
- `createdAt`/`updatedAt` on all records
- PostgreSQL enums for status fields
- Row-level security policies using `pgPolicy()`
- Relations defined in `lib/db/relations.ts`

### Data Layer Architecture

**Two-layer approach:**

1. **Queries layer** (`lib/queries/`) - Low-level database operations
   - Direct Drizzle queries
   - Minimal business logic
   - Organized by domain: tasks, projects, clients, time-logs, etc.

2. **Data layer** (`lib/data/`) - Business logic assembly
   - Combines multiple queries
   - Enforces permissions
   - Example: `fetchProjectsWithRelations()` calls `fetchBaseProjects()`, then parallel fetches relations, then assembles final structure
   - Uses React `cache()` for automatic deduplication

**Access control:**
- All queries enforce permission checks
- Admin sees all data
- Non-admins scoped via `client_members` table
- Personal projects only visible to creator
- Internal projects visible to all team members

### Authentication & Permissions

**Session management** (`lib/auth/session.ts`):
- `getSession()` - Retrieve Supabase session
- `getCurrentUser()` - Combine Supabase auth with database user record
- `requireUser()` - Guard protected routes (throws if unauthenticated)
- `requireRole()` - Role-based access control

**Permission helpers** (`lib/auth/permissions.ts`):
- `isAdmin(user)` - Boolean role check
- `assertAdmin(user)` - Throws ForbiddenError if not admin
- `ensureClientAccess(userId, clientId)` - Verify client membership
- `ensureClientAccessByProjectId(userId, projectId)` - Verify project access
- `listAccessibleTaskIds(userId)` - Scope tasks by user memberships

**Roles:**
- `ADMIN` - Full access to all data
- `CLIENT` - Scoped access based on client memberships

### State Management

**Server-first pattern:**
- React Server Components for initial render
- Server Actions in `_actions/` directories (marked with `'use server'`)
- Use TanStack React Query only for client-side mutations and polling

**Providers** (`components/providers/`):
- `ReactQueryProvider` - Client-side cache
- `PostHogProvider` - Analytics
- `ThemeProvider` - Dark/light mode
- `SupabaseListener` - Real-time session sync

### Error Handling

Use standardized error classes from `lib/errors/http.ts`:
- `UnauthorizedError` - 401, user not authenticated
- `ForbiddenError` - 403, user lacks permission
- `NotFoundError` - 404, resource not found

API responses follow `{ ok: boolean, data?: T, error?: string }` pattern.

### UI Components

**Component library:**
- Radix UI primitives in `components/ui/`
- Custom business components in `components/` organized by feature
- Rich text editor: TipTap with extensions (highlight, link, image, typography, etc.)
- Drag-and-drop: `@dnd-kit` for kanban boards and task ordering

**Form handling:**
- React Hook Form for state
- Zod for validation (schemas alongside forms)
- Custom hook: `useSheetFormControls()` for modal/drawer forms with history

### File Storage

**Supabase Storage setup:**
- **Bucket: `user-avatars`** - Private bucket with authenticated access (must be created manually)
- **Bucket: `task-attachments`** - Task files

**Storage utilities:**
- `lib/storage/avatar.ts` - Upload/delete user avatars
- `lib/storage/task-attachments.ts` - Upload/delete task files
- Signed URLs generated for secure access

### Activity System

**Event tracking** (`lib/activity/events/`):
- Domain-specific event handlers: `tasks.ts`, `projects.ts`, `clients.ts`, `time-logs.ts`, `users.ts`, `hour-blocks.ts`
- Centralized in `lib/activity/events.ts`
- Activity feed with highlights computation
- Overview cache for performance (`activity_overview_cache` table)

**Usage:**
```typescript
import { logTaskCreated } from '@/lib/activity/events/tasks'
await logTaskCreated(taskId, userId)
```

### PostHog Analytics

**Configuration:**
- Never hallucinate API keys; use keys from `.env` file
- Event tracking via `lib/posthog/client.ts` (client-side) and `lib/posthog/server.ts` (server-side)
- Feature flags stored in enums/const objects with UPPERCASE_WITH_UNDERSCORE naming
- Gate flag-dependent code on value validation checks

**Rules:**
- Use each feature flag in as few places as possible
- For custom properties referenced in 2+ files/callsites, use enum or const object
- Consult developer before creating new event/property names (naming consistency is essential)
- Changes to existing event/property names may break reporting

### Lead Intake Webhook

**Endpoint:** `POST /api/integrations/leads-intake`

**Authentication:** Bearer token matching `LEADS_INTAKE_TOKEN` env var

**Setup:**
1. Generate token: `openssl rand -hex 32`
2. Store in this app: `LEADS_INTAKE_TOKEN`
3. Store in marketing site: `PORTAL_LEADS_TOKEN`

**Payload shape:**
```json
{
  "name": "string (required)",
  "email": "string (required)",
  "company": "string (optional)",
  "website": "string (optional)",
  "message": "string (optional)",
  "sourceDetail": "string (optional)"
}
```

Leads are inserted with `WEBSITE` source and appear on `/leads/board` immediately.

### Key Patterns & Conventions

**Soft deletes:**
- All core entities use `deletedAt` timestamps
- Active records: `WHERE deletedAt IS NULL`
- Archive/restore via setting/clearing `deletedAt`
- Never hard delete records (preserve historical data)

**Slug-based URLs:**
- Projects: `[clientSlug]/[projectSlug]`
- Slugs generated from names with uniqueness constraints
- Redirect logic ensures canonical URLs

**Sort order tracking:**
- `task_assignee_metadata` table preserves assignee order
- `rank` field on tasks for custom board ordering
- Separate from database-native ordering

**Type safety:**
- TypeScript strict mode
- Zod schemas for runtime validation
- Type generation from Drizzle schema
- Server-only imports: Mark with `'server-only'` to prevent client-side execution

**Performance:**
- React Compiler enabled (`next.config.ts`)
- Parallel data loading with `Promise.all()`
- TanStack Virtual for long lists
- Strategic indexes on foreign keys and filtered columns

## Common Workflows

### Adding a new task status
1. Update `taskStatus` enum in `lib/db/schema.ts`
2. Run `npm run db:generate -- --name add_task_status`
3. Review generated migration
4. Apply: `npm run db:migrate`
5. Update UI components that reference task statuses
6. Update `lib/projects/task-status.ts` if status logic changes

### Creating a new protected route
1. Add page under `app/(dashboard)/your-route/page.tsx`
2. Use `requireUser()` or `requireRole()` in Server Component
3. Fetch data using functions from `lib/data/`
4. Add navigation link if needed

### Adding a new API endpoint
1. Create route in `app/api/your-endpoint/route.ts`
2. Export handler: `export async function POST(req: Request) { ... }`
3. Use `getCurrentUser()` for auth
4. Apply permission checks with `ensureClientAccess()` or `assertAdmin()`
5. Return standardized responses: `{ ok: true, data }` or `{ ok: false, error }`

### Creating a new table
1. Define schema in `lib/db/schema.ts`
2. Add relations in `lib/db/relations.ts`
3. Generate migration: `npm run db:generate -- --name table_name`
4. Review SQL in `drizzle/migrations/`
5. Apply: `npm run db:migrate`
6. Add query functions in `lib/queries/`
7. Add data layer functions in `lib/data/`

### Logging activity events
1. Create event handler in `lib/activity/events/domain.ts`
2. Export handler from `lib/activity/events.ts`
3. Call handler after mutations: `await logTaskUpdated(taskId, userId, changes)`
4. Activity appears in feeds automatically
