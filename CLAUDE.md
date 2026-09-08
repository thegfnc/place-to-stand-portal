# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

This is a **Turborepo monorepo** using npm workspaces.

```
place-to-stand-portal/
├── apps/
│   ├── internal/          # Admin portal (Next.js, deployed to Vercel, port 3000)
│   │   ├── app/           # Next.js App Router routes
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Business logic, data layer, utilities
│   │   ├── styles/        # Global CSS
│   │   └── public/        # Static assets
│   └── client/            # Client portal (Next.js, deployed to Vercel, port 3001)
│       ├── app/           # Next.js App Router routes
│       ├── components/    # React components
│       ├── lib/           # Auth, data fetching, utilities
│       └── styles/        # Global CSS
├── packages/
│   ├── db/                # Shared database schema, relations, and migrations (@pts/db)
│   ├── github/            # GitHub App auth and API utilities (@pts/github)
│   └── cli/               # `pts` admin CLI, consumes /api/cli/v1 (@pts/cli, not published)
├── supabase/              # Supabase config (stays at root)
├── turbo.json             # Build orchestration
├── tsconfig.base.json     # Shared TypeScript config
└── package.json           # Workspace root
```

The two main apps are `apps/internal/` (admin portal) and `apps/client/` (client portal). Unqualified paths like `lib/`, `app/`, `components/` refer to directories inside `apps/internal/` unless stated otherwise. Shared database schema, GitHub utilities, and the admin CLI live in `packages/`.

## Commands

### Development (from repo root)
- `npm run dev` - Start all apps via Turbo
- `npm run build` - Build all apps via Turbo
- `npm run lint` - Lint all apps via Turbo
- `npm run type-check` - Type-check all apps via Turbo
- `npm run cli:link` - Build the `pts` CLI and link it onto your PATH (see `packages/cli/README.md`)

### Development (from `apps/internal/` or `apps/client/`)
- `npm run dev` - Start app with Turbopack (internal: port 3000, client: port 3001)
- `npm run build` - Build app with Turbopack
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler checks (no emit)

### Database (Drizzle ORM)
Run these from `apps/internal/`. Ensure `DATABASE_URL` is set in your environment.

- `npm run db:pull` - Introspect database schema into schema file (use sparingly, only when DB is source of truth)
- `npm run db:generate -- --name <change>` - Generate SQL migration from schema edits
- `npm run db:migrate` - Apply migrations to database

**Migration workflow:**
1. Update schema files in `packages/db/src/schema.ts` and `packages/db/src/relations.ts`
2. Run `npm run db:generate -- --name descriptive_label` from `packages/db/`
3. Review generated SQL in `packages/db/drizzle/migrations/`
4. Apply locally with `npm run db:migrate`, then in staging/production

The baseline migration (`packages/db/drizzle/migrations/0000_supabase_baseline.sql`) captures existing Supabase schema. Run `npm run db:migrate` once after configuring `DATABASE_URL` to register existing state.

### Turbo Environment Variables
Turbo v2 uses strict mode by default — only env vars listed in `turbo.json` are passed to build tasks. When adding a new server-side env var:
1. Add it to the appropriate app's `lib/env.server.ts` schema (`apps/internal/` or `apps/client/`)
2. Add it to `turbo.json` → `tasks.build.passThroughEnv` (secrets that shouldn't bust cache) or `tasks.build.env` (vars that should invalidate cache)

## Architecture Overview

### Tech Stack
- **Monorepo**: Turborepo with npm workspaces
- **Framework**: Next.js 16 (App Router) with Turbopack
- **Database**: PostgreSQL via Supabase with Drizzle ORM (schema in `packages/db`)
- **Auth**: Supabase Auth with session-based authentication
- **Storage**: Supabase Storage (buckets: `user-avatars`, `task-attachments`)
- **State**: React Server Components + TanStack React Query
- **Styling**: Tailwind CSS v4, Radix UI, shadcn/ui components
- **Analytics**: PostHog (client and server-side)
- **Email**: Resend
- **GitHub Integration**: GitHub App for repo linking (`packages/github`)
- **Vercel / Supabase linking**: staff personal access tokens stored encrypted in `oauth_connections`; provider adapters in `apps/internal/lib/integrations/`, routes under `api/integrations/[provider]/`

### Route Organization

**Internal admin portal** (`apps/internal/app/`):
```
├── (auth)/           # Sign-in, forgot/force-reset password (unauthenticated)
├── (dashboard)/      # Protected routes
│   ├── clients/      # Client management ([clientSlug] detail, archive, activity)
│   ├── contacts/     # Contact management, portal user promotion (archive, activity)
│   ├── hour-blocks/  # Prepaid hour block management (archive, activity)
│   ├── invoices/     # Invoicing (settings, archive, activity)
│   ├── leads/        # Lead kanban board (board, archive, activity)
│   ├── my/           # Current user's pages (home, tasks)
│   ├── projects/     # Project workspace (tabbed, see below; archive, activity)
│   ├── reports/      # Reports (monthly-close)
│   ├── settings/     # Users, projects, integrations
│   └── submissions/  # Website form submissions
├── (public)/         # Publicly shared pages (e.g. share/invoices/[token])
├── api/              # API routes: v1/, cli/v1/, tasks/, task-comments/, my-tasks/,
│                     #   projects/, clients/, contacts/, leads/, invoices/, dashboard/,
│                     #   activity/, planning/, uploads/, storage/, public/, auth/,
│                     #   github/, google/,
│                     #   integrations/ (leads-intake, stripe, github, google, ...)
├── auth/             # Supabase auth callback
└── unauthorized/     # Access denied page
```

**CLI API (`api/cli/v1/`)** — the machine surface consumed by `packages/cli`. Unlike the
cookie-authenticated routes above it authenticates by bearer JWT, so `/api/cli/` is on the
`proxy.ts` allowlist and every route **must** wrap itself in `withCliAuth` (`lib/cli/handler.ts`);
there is no edge-level fallback. Responses are always enveloped (`{ ok, data }`) and camelCase —
do not follow the bare-envelope, snake_case precedent set by `api/v1/`. Adding a resource means a
serializer in `lib/cli/serializers/` plus a thin route; the serializers are the contract agents
hardcode against, so adding a field is safe and renaming one is breaking.

The project workspace is tabbed: `/projects/[clientSlug]/[projectSlug]/{tasks,overview,review,time-logs,activity,archive}`. The task board lives on the `tasks` tab, and the task sheet opens over it via the `?task=<uuid>` query param — never a route segment (see **Sheet deep links** below). Board links come from `buildBoardPath`, which keeps the board mounted across task selection instead of remounting it the way the retired trailing-segment URLs did.

**Client portal** (`apps/client/app/`):
```
├── (auth)/           # Sign-in, forgot/force-reset password (unauthenticated)
├── (portal)/         # Protected routes (force-dynamic)
│   ├── projects/     # Project detail with GitHub integration ([projectId])
│   └── github/       # GitHub App setup and management
├── api/github/       # GitHub App install, callback, webhook, repos, link
├── onboarding/       # First-time setup wizard
└── unauthorized/     # Access denied page
```

Portal access is controlled via `client_members` table. Contacts promoted to portal users automatically get access to their linked clients.

### Database Schema

**Core tables** (`packages/db/src/schema.ts`):
- `users` - User accounts with roles (ADMIN, CLIENT)
- `clients` - Client records with billing types (prepaid, net_30)
- `contacts` - Contact records (may have a `userId` for portal access)
- `contact_clients` - Contact-to-client links
- `contact_leads` - Contact-to-lead links
- `client_members` - Client-to-user portal memberships (auto-synced when contacts are linked/promoted)
- `projects` - Projects with types: CLIENT (tied to clients), PERSONAL (individual), INTERNAL (team); status: ONBOARDING → ACTIVE → ON_HOLD → COMPLETED
- `tasks` - Tasks with workflow: ON_DECK → IN_PROGRESS → BLOCKED → DONE → ARCHIVED
- `leads` - Lead pipeline: NEW_OPPORTUNITIES → ACTIVE_OPPORTUNITIES → PROPOSAL_SENT → ON_ICE → CLOSED_WON/CLOSED_LOST/UNQUALIFIED
- `lead_stage_history` - Lead stage transition history
- `time_logs` + `time_log_tasks` - Time tracking linked to tasks/projects
- `hour_blocks` - Prepaid hour contracts
- `task_comments` - Task discussions
- `task_attachments` - File attachments
- `task_assignees` + `task_assignee_metadata` - Task assignments with custom sort order
- `task_deployments` - Deployments linked to tasks
- `invoices` + `invoice_line_items` - Invoicing
- `product_catalog_items` + `tax_rates` - Invoice line-item catalog and tax configuration
- `planning_sessions` + `plan_threads` + `plan_revisions` + `plan_messages` - AI planning sessions
- `form_submissions` - Website form submissions
- `oauth_connections` - Google/GitHub OAuth connections
- `github_app_installations` - GitHub App installs per client
- `github_repo_links` - Repository links per project
- `project_integration_links` - Vercel/Supabase projects linked to projects (external ids only; access resolved per viewer from their own token in `oauth_connections`)
- `activity_logs` + `activity_overview_cache` - Activity audit trail

**Key patterns:**
- UUIDs for primary keys
- Soft deletes via `deletedAt` timestamps on all core tables
- `createdAt`/`updatedAt` on all records
- PostgreSQL enums for status fields
- Relations defined in `packages/db/src/relations.ts`
- Both apps import schema via `@pts/db/schema`
- **NO Row Level Security** - access control is handled in the application layer (see below)

### Data Layer Architecture

**Two-layer approach:**

1. **Queries layer** (`apps/internal/lib/queries/`) - Low-level database operations
   - Direct Drizzle queries
   - Minimal business logic
   - Organized by domain: tasks, projects, clients, time-logs, etc.

2. **Data layer** (`apps/internal/lib/data/`) - Business logic assembly
   - Combines multiple queries
   - Enforces permissions
   - Example: `fetchProjectsForLanding()` calls `fetchBaseProjects()`, then parallel fetches relations, then assembles final structure
   - Uses React `cache()` for automatic deduplication

**Access control:**
- The internal portal is **admin-only**: CLIENT-role users are rejected at sign-in and any non-ADMIN session is redirected to the client portal (`CLIENT_PORTAL_URL`) by `requireUser()`
- Mutations and API routes still guard with `assertAdmin()`/`requireRole('ADMIN')` as defense-in-depth
- `ensure*Access` helpers verify the target entity exists (NotFound) before mutations
- Client-scoped access lives exclusively in `apps/client/` (via `client_members`)

**CRITICAL: No Row Level Security (RLS)**

This project does NOT use PostgreSQL Row Level Security. All access control is handled in the application layer via:
- Permission helpers in `apps/internal/lib/auth/permissions.ts`
- Query functions in `apps/internal/lib/queries/` that enforce scoping
- Data layer in `apps/internal/lib/data/` that assembles and filters results

**NEVER:**
- Add `ENABLE ROW LEVEL SECURITY` to any table
- Create `CREATE POLICY` statements in migrations
- Use `pgPolicy()` in Drizzle schema definitions
- Import `pgPolicy` from `drizzle-orm/pg-core`
- Create helper functions like `is_admin()` for RLS

**Why:**
- Application-layer access control is easier to test and debug
- RLS policies create hidden complexity and hard-to-trace permission issues
- Supabase RLS requires `auth.uid()` which couples DB to auth provider
- All data access already flows through permission-checked functions

### Authentication & Permissions

**Session management** (`apps/internal/lib/auth/session.ts`):
- `getSession()` - Retrieve Supabase session
- `getCurrentUser()` - Combine Supabase auth with database user record
- `requireUser()` - Guard protected routes; redirects unauthenticated users to `/sign-in` and non-ADMIN sessions to the client portal
- `requireRole()` - Role-based access control (defense-in-depth on admin pages)

**Permission helpers** (`apps/internal/lib/auth/permissions.ts`) — all take the `AppUser` object, not a bare user id:
- `assertAdmin(user)` - Throws ForbiddenError if not admin
- `ensure{Project,Task,TimeLog}Access(user, id)` - Assert admin + verify the entity exists and is not soft-deleted (NotFoundError)

**Roles:**
- `ADMIN` - Full access to the internal portal
- `CLIENT` - Client-portal users only; blocked from the internal portal at sign-in (redirected to `CLIENT_PORTAL_URL`). The role still exists so the internal portal can create/manage portal users.

### State Management

**Server-first pattern:**
- React Server Components for initial render
- Server Actions in `_actions/` directories (marked with `'use server'`)
- Use TanStack React Query only for client-side mutations and polling

**Providers** (`apps/internal/components/providers/`):
- `ReactQueryProvider` - Client-side cache
- `PostHogProvider` - Analytics
- `ThemeProvider` - Dark/light mode
- `SupabaseListener` - Real-time session sync

### Error Handling

Use standardized error classes from `apps/internal/lib/errors/http.ts`:
- `UnauthorizedError` - 401, user not authenticated
- `ForbiddenError` - 403, user lacks permission
- `NotFoundError` - 404, resource not found

API responses follow `{ ok: boolean, data?: T, error?: string }` pattern.

### UI Components

**Component library:**
- Radix UI primitives in `apps/internal/components/ui/`
- Custom business components in `apps/internal/components/` organized by feature
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
- `apps/internal/lib/storage/avatar.ts` - Upload/delete user avatars
- `apps/internal/lib/storage/task-attachments.ts` - Upload/delete task files
- Signed URLs generated for secure access

### Activity System

**Event tracking** (`apps/internal/lib/activity/events/`):
- Domain-specific event handlers: `tasks.ts`, `projects.ts`, `clients.ts`, `contacts.ts`, `leads.ts`, `invoices.ts`, `time-logs.ts`, `users.ts`, `hour-blocks.ts`
- Centralized in `apps/internal/lib/activity/events.ts`
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
- Event tracking via `apps/internal/lib/posthog/client.ts` (client-side) and `apps/internal/lib/posthog/server.ts` (server-side)
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

**Sheet deep links (`lib/sheets/`):**

Every entity sheet is addressed by one query param — `?client=<uuid>`, `?task=new`, `?lead=<uuid>&leadMode=convert` — never by a route segment. A param opens its sheet on *any* dashboard route: canonical list pages render their own instance (instant open), and the global `SheetHost` in `(dashboard)/layout.tsx` covers every other route by fetching `GET /api/sheets/init`. Param order in the URL is the sheet stack order, so a sheet can open another sheet (`?lead=<id>&task=new`).

Conventions, all enforced by `useSheetParams`/`useSheetParamSelection` — never hand-roll sheet URL writes:
- Value is a UUID or `new` (create sheet). UUID-guard before any DB cast.
- Open = `router.push`, close = `router.replace`, always `{ scroll: false }`, unrelated params preserved.
- **Save = done = close** for create *and* edit, matching every sheet: a successful save clears the entity param. Never transition a create sheet into edit mode (see `task-sheet-closes-on-save`).
- Paginated/filtered list pages resolve the param server-side with `resolveSheetDeepLink()` so a link to a row on page 3 still opens, and cross-redirect between active/archive tabs.
- Generate links with the builders in `lib/sheets/hrefs.ts` (board task links come from `buildBoardPath`), never string-concatenated inline.

**Adding a deep-linkable entity:** add the param to `lib/sheets/entities.ts` (with `claimsPathname` for its host pages), a payload type + resolver in `lib/sheets/init/`, a wrapper in `lib/sheets/wrappers/`, and one line in `lib/sheets/registry.tsx`.

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
- React Compiler enabled (`apps/internal/next.config.ts`)
- Parallel data loading with `Promise.all()`
- TanStack Virtual for long lists
- Strategic indexes on foreign keys and filtered columns

## Common Workflows

### Adding a new task status
1. Update `taskStatus` enum in `packages/db/src/schema.ts`
2. Run `npm run db:generate -- --name add_task_status` from `packages/db/`
3. Review generated migration
4. Apply: `npm run db:migrate`
5. Update UI components that reference task statuses
6. Update `apps/internal/lib/projects/task-status.ts` if status logic changes

### Creating a new protected route
1. Add page under `apps/internal/app/(dashboard)/your-route/page.tsx`
2. Use `requireUser()` or `requireRole()` in Server Component
3. Fetch data using functions from `apps/internal/lib/data/`
4. Add navigation link if needed

### Adding a new API endpoint
1. Create route in `apps/internal/app/api/your-endpoint/route.ts`
2. Export handler: `export async function POST(req: Request) { ... }`
3. Use `getCurrentUser()` for auth
4. Apply permission checks with `assertAdmin()` (plus `ensure*Access()` for entity existence)
5. Return standardized responses: `{ ok: true, data }` or `{ ok: false, error }`

### Creating a new table
1. Define schema in `packages/db/src/schema.ts`
2. Add relations in `packages/db/src/relations.ts`
3. Generate migration: `npm run db:generate -- --name table_name` from `packages/db/`
4. Review SQL in `packages/db/drizzle/migrations/`
5. Apply: `npm run db:migrate`
6. Add query functions in `apps/internal/lib/queries/`
7. Add data layer functions in `apps/internal/lib/data/`

### Adding a new server-side env var
1. Add Zod validation to the appropriate app's `lib/env.server.ts`
2. Add to `turbo.json` → `tasks.build.passThroughEnv` (or `env` if it should bust cache)
3. Add to the correct Vercel project settings for all required environments
4. Add to the app's `.env.example`

**Cross-app env vars:**
- `CLIENT_PORTAL_URL` (internal app) — full URL of the client portal (e.g. `https://clients.placetostandagency.com`)
- `GITHUB_APP_*` (client app) — GitHub App credentials for repo integration

### Logging activity events
1. Create event handler in `apps/internal/lib/activity/events/domain.ts`
2. Export handler from `apps/internal/lib/activity/events.ts`
3. Call handler after mutations: `await logTaskUpdated(taskId, userId, changes)`
4. Activity appears in feeds automatically

## Development Standards

See `AGENTS.md` for comprehensive development practices including:
- LLM implementation workflow (read first, clarify scope, design before code)
- Development practices (modular architecture, SRP, DRY, git hygiene)
- Non-functional requirements (accessibility, performance, security)
- Observability and operations guidelines

**Key guardrails from AGENTS.md:**
- Do not hand-edit dependencies, lockfiles, or migrations — use the CLIs so `package-lock.json` and the schema stay in sync. Other `package.json` config (scripts, workspace fields) is fine to edit.
- Always run `npm run build`, `npm run lint`, `npm run type-check` from the repo root (runs via Turbo) for touched surfaces
- Prefer existing modules, utilities, and shadcn components before building new
- Files approaching 300 lines should be split by responsibility

## Review Skills

Custom skills available for code quality reviews. Invoke with `/skill-name`:

### Code Quality Reviews
| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `/security-review` | OWASP Top 10, auth/authz audit | Before merging security-sensitive changes |
| `/performance-review` | Core Web Vitals, React patterns | After adding components or data fetching |
| `/db-review` | Schema normalization, indexing | After schema changes or new tables |
| `/accessibility-review` | WCAG 2.1 AA compliance | After UI changes |
| `/refactor` | Dead code, duplication, complexity | During cleanup sprints |
| `/bug-hunt` | Logic errors, async issues, edge cases | Investigating bugs or reviewing complex logic |

### System Health Reviews
| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `/architecture-review` | Module boundaries, coupling, data flow | Planning features, system feels tangled |
| `/dependency-audit` | npm security, outdated packages, licenses | Before releases, security hygiene |
| `/observability-review` | Logging, error tracking, monitoring | After incidents, debugging is hard |
| `/tech-debt-inventory` | Catalog and prioritize technical debt | Planning cycles, quarterly reviews |

### Documentation & Release
| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `/test-plan` | Manual test case generation | Before releases or feature completion |
| `/docs` | API/component documentation | After adding public interfaces |
| `/release-checklist` | Pre-deploy verification, rollback plan | Before production deployments |

**Built-in PR review** (via plugins):
- `/review-pr` - Comprehensive PR review using multiple specialized agents
- `/code-review` - Single-pass code review

### Running Reviews

```bash
# Review staged changes
/security-review  # then describe: "Review staged changes"

# Review specific files
/performance-review  # then describe: "Review components/dashboard/"

# Review a PR
/review-pr 123  # Reviews PR #123 using Greptile

# System-level reviews
/architecture-review  # then describe: "Review the data layer"
/dependency-audit     # runs npm audit and analyzes results
/release-checklist    # pre-deployment verification
```

## Subagents

The following specialized agents are available via the Task tool:

| Agent | Purpose |
|-------|---------|
| `feature-dev:code-reviewer` | Reviews for bugs, security, code quality |
| `feature-dev:code-explorer` | Deep codebase analysis and architecture mapping |
| `feature-dev:code-architect` | Designs feature architectures with implementation blueprints |
| `pr-review-toolkit:code-reviewer` | Reviews against project guidelines |
| `pr-review-toolkit:silent-failure-hunter` | Finds inadequate error handling |
| `pr-review-toolkit:code-simplifier` | Simplifies code while preserving functionality |
| `pr-review-toolkit:pr-test-analyzer` | Reviews test coverage quality |
| `Explore` | Fast codebase exploration (files, patterns, architecture) |
| `Plan` | Software architect for implementation planning |
