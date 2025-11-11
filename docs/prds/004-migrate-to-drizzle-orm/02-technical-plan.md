# 02: Technical Plan

- **Title:** Drizzle ORM Migration - Technical Plan
- **Status:** Completed (2025-11-10)
- **Author:** Jason Desiderio
- **Date:** 2025-11-08

---

## 1. Phased Implementation Strategy

The migration will be executed in four distinct phases to minimize risk and ensure a smooth transition. Each phase builds upon the last, allowing for verification and testing at each stage.

---

### **Phase 1: Setup, Configuration & Connection Test**

**Goal:** Establish a working Drizzle connection to the Supabase database and validate it with a proof-of-concept.

1.  **Install Dependencies:**
    - Add `drizzle-orm` and the `postgres` driver: `npm i drizzle-orm postgres`
    - Add `drizzle-kit` and `dotenv` as dev dependencies: `npm i -D drizzle-kit dotenv`

2.  **Configure Environment:**
    - Retrieve the **Connection Pooler URI** from the Supabase dashboard (Settings > Database).
    - Add it to a `.env.local` file as `DATABASE_URL`. Ensure the `[YOUR-PASSWORD]` placeholder is replaced.

3.  **Create Database Client:**
    - Create a new file, `lib/db/index.ts`, to initialize and export the Drizzle client. This setup ensures a single, reusable connection instance.
    - Based on official guidance, use `postgres-js` and disable `prepare` as it's not supported in Supabase's "Transaction" pool mode.

    ```typescript:lib/db/index.ts
    import 'dotenv/config';
    import { drizzle } from 'drizzle-orm/postgres-js';
    import postgres from 'postgres';

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }

    // Disable prefetch as it is not supported for "Transaction" pool mode
    const client = postgres(process.env.DATABASE_URL, { prepare: false });
    export const db = drizzle(client);
    ```

4.  **Initial Schema Generation:**
    - Create a `drizzle.config.ts` file in the project root to configure `drizzle-kit`.

    ```typescript:drizzle.config.ts
    import type { Config } from 'drizzle-kit';
    import 'dotenv/config';

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }

    export default {
      schema: './lib/db/schema.ts',
      out: './drizzle/migrations',
      dialect: 'postgresql',
      dbCredentials: {
        url: process.env.DATABASE_URL,
      },
    } satisfies Config;
    ```
    - Run `drizzle-kit introspect` to automatically generate the initial Drizzle schema file (`lib/db/schema.ts`) based on the existing Supabase database. This provides an immediate, type-safe representation of our tables.

5.  **Proof-of-Concept Connection Test:**
    - Create a new, temporary API route (e.g., `app/api/test-drizzle/route.ts`).
    - In this route, import the Drizzle client and perform a simple, read-only query (e.g., `SELECT * FROM users LIMIT 1`).
    - Successfully executing this query and returning data will confirm that the connection, configuration, and schema are all working correctly before proceeding with the full migration.

> **Implementation status (2025-11-08):** Complete. The shared client lives in `lib/db/index.ts`, schema exports in `lib/db/schema.ts`, CLI config in `drizzle.config.ts`, and the verification route at `app/api/test-drizzle/route.ts`. Drizzle introspection artifacts now live under `drizzle/migrations/`. See `phase-1/README.md` for detailed notes.

---

### **Phase 2: RLS Policy Migration & Application-Level Auth**

**Goal:** Analyze all existing RLS policies and establish a clear strategy for reimplementing them as application-level authorization checks.

1.  **RLS Policy Analysis:**
    - A complete analysis of the current RLS policies is documented in `03-rls-policy-analysis.md`. This document will serve as the source of truth for the required authorization logic.

2.  **Authorization Helper Functions:**
    - Develop a set of reusable server-side helper functions to encapsulate authorization logic. These functions will take the authenticated user's session as input and determine their permissions.
    - **Examples:**
        - `canViewClient(user, clientId)`: Checks if a user is a member of the client.
        - `canEditTask(user, taskId)`: Checks if a user has permission to modify a task.
        - `isAdmin(user)`: A simple check for the 'ADMIN' role.

3.  **Data Access Layer Scaffolding:**
    - Create a structured directory for Drizzle queries (e.g., `lib/queries/`).
    - For each database entity (e.g., `clients`, `projects`, `tasks`), create a corresponding file (e.g., `lib/queries/tasks.ts`).
    - Each file will contain functions for all CRUD operations on that entity (e.g., `getTaskById`, `createTask`, `updateTask`).
    - **Crucially, every function in this layer must call the appropriate authorization helper before executing a query.** If authorization fails, it should throw a `403 Forbidden` error.

> **Implementation status (2025-11-08):** Phase 2 foundations are in place. Authorization helpers live in `lib/auth/permissions.ts`, standard `HttpError` types in `lib/errors/http.ts`, and query scaffolding under `lib/queries/` now delegates to the guard layer. See `phase-2/README.md` for details.

---

### **Phase 3: Incremental Refactoring**

**Goal:** Systematically replace all `supabase-js` data calls with the new Drizzle-based data access layer, module by module.

1.  **Module-by-Module Refactoring:**
    - We will approach the refactoring one feature or domain at a time (e.g., first Clients, then Projects, then Tasks).
    - For each module:
        a. Identify all server-side components and API routes that use `supabase-js` for data access.
        b. Replace the calls with the corresponding functions from our new Drizzle data access layer (`lib/queries/*`).
        c. Ensure all data-fetching hooks (e.g., React Query's `useQuery`) and server actions are updated to use the new data layer.

> **Implementation status (2025-11-08):** The Settings → Users, Settings → Clients, Settings → Projects, and Tasks domains are fully migrated. Server services, actions, settings pages, and the reorder API now rely on the Drizzle query layer with shared authorization helpers, eliminating bespoke Supabase fetchers. See `phase-3/README.md` for the refactor log and verification notes.

2.  **Testing:**
    - After refactoring each module, conduct thorough testing to ensure functional parity. This includes manual testing of the UI and running any relevant automated tests.

---

### **Phase 4: Finalization & RLS Decommission**

**Goal:** Complete the migration, remove all legacy code, and officially disable RLS in Supabase.

1.  **Full Regression Test:**
    - Once all modules are migrated, perform a full end-to-end regression test of the entire application in a staging environment.

2.  **Code Cleanup:**
    - Uninstall the `@supabase/supabase-js` package if it is no longer used for data queries (it may still be required for Auth and Storage).
    - Remove the temporary `app/api/test-drizzle` route.
    - Delete any other legacy code related to the old data access pattern.

3.  **Disable RLS in Supabase:**
    - Connect to the Supabase dashboard or use a SQL script to run `ALTER TABLE ... DISABLE ROW LEVEL SECURITY;` on all migrated tables. This is the final step that officially decouples us from the RLS system.

4.  **Documentation Update:**
    - Update the `AGENTS.md` file and any other relevant developer documentation to reflect the new data access patterns with Drizzle ORM and application-level authorization.


> **Implementation status (2025-11-10):** All production surfaces now depend exclusively on the Drizzle data layer. The legacy `app/api/test-drizzle` route is removed, `@supabase/supabase-js` remains only for Auth and Storage flows, RLS is disabled via migration `20251110123000_disable_rls.sql`, and docs (including `AGENTS.md` and `docs/prds/004-migrate-to-drizzle-orm/phase-4/README.md`) document the operational playbooks and Drizzle-first architecture.
