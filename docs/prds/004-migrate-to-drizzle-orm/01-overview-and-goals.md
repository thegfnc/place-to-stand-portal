# 01: Overview & Goals

- **Title:** Migrate Data Access Layer to Drizzle ORM
- **Status:** Proposed
- **Author:** Jason Desiderio
- **Date:** 2025-11-08

---

## 1. Introduction & Vision

### 1.1. Problem Statement

Our current data access layer is tightly coupled to Supabase's client-side libraries (`supabase-js`) and its ecosystem features like PostgREST and Row-Level Security (RLS). This dependency presents several challenges:
- **Limited Flexibility:** It restricts us from treating our Supabase instance as a standard Postgres database, preventing the use of more powerful, flexible, or efficient database tools.
- **RLS Complexity:** Managing complex authorization logic through RLS policies can become cumbersome, difficult to debug, and hard to version control effectively alongside application code.
- **Vendor Lock-in:** The deep integration with Supabase-specific features makes it difficult to migrate or adopt alternative infrastructure in the future.

### 1.2. Project Goal & Vision

The goal is to decouple our application from Supabase's data access patterns by migrating to Drizzle ORM. This will allow us to interact with our database as a pure Postgres instance.

The long-term vision is to establish a more robust, scalable, and maintainable architecture where:
- The database is a simple data store.
- All business and authorization logic resides within the application layer, making it more explicit, testable, and easier to manage.
- We retain the benefits of Supabase for authentication and file storage while gaining full control over our data access layer.

## 2. Scope

### 2.1. In Scope
- **Introduce Drizzle ORM:** Integrate Drizzle and `drizzle-kit` for schema definition, type-safe querying, and migrations.
- **Replace Data Queries:** Systematically refactor all existing server-side data fetching and mutation logic (`select`, `insert`, `update`, `delete`, `rpc`) to use Drizzle.
- **Application-Level Authorization:** Re-implement all authorization logic currently handled by RLS policies within our Next.js API routes and server-side logic.
- **Disable RLS:** Once the migration is complete and verified, RLS will be disabled on all public tables.
- **Maintain Functionality:** The application must retain full functionality, including Supabase Auth and Storage.

### 2.2. Out of Scope
- **Frontend Changes:** No significant changes to UI components, except where necessary to accommodate new data shapes or fetching patterns.
- **Database Schema Changes:** The core database schema will remain unchanged, although Drizzle will now be used to manage and version it.
- **Supabase Auth & Storage:** We will continue to use the `supabase-js` SDK for authentication (`auth.signIn`, `auth.signOut`, etc.) and file storage.

## 3. Success Metrics

- **Functional Parity:** The application must function identically to the user before and after the migration. All existing tests must pass.
- **Performance:** API response times should be equal to or better than the current implementation. We will monitor key endpoints for any degradation.
- **Developer Experience:** The new data access layer should be fully type-safe, improving developer productivity and reducing the likelihood of runtime data errors.
- **Security:** A security review will be conducted to ensure that application-level authorization logic correctly replicates and covers all scenarios previously handled by RLS.
