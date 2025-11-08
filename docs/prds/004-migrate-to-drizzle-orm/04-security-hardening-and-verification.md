# 04: Security Hardening & Verification

- **Title:** Security Hardening Plan for Drizzle Migration
- **Status:** Proposed
- **Author:** Jason Desiderio
- **Date:** 2025-11-08

---

## 1. Overview

After migrating the application's data access layer to Drizzle and reimplementing authorization logic, this final phase focuses on hardening the Supabase environment and rigorously verifying that no data leaks or security regressions have been introduced. The goal is to ensure our security posture is as strong, or stronger, than it was with RLS.

---

## 2. Supabase Environment Hardening

These steps are designed to lock down the Supabase project, ensuring that the only path to the data is through our new, secure, application-level logic.

### 2.1. Disable the PostgREST API
The primary goal of this migration is to bypass the Supabase Data API (PostgREST). Disabling it ensures that no external actor can interact with the database through this layer.

-   **Action:** In the Supabase dashboard, navigate to **API Settings** and turn off the PostgREST API.
-   **Verification:** After disabling it, confirm that API requests made via old methods (e.g., using `curl` or Postman) to the PostgREST endpoint fail.

### 2.2. Restrict Direct Database Access
Since Drizzle connects directly to the Postgres database, we must lock down this connection.

-   **Action:** In the Supabase dashboard, go to **Database Settings > Network Restrictions**. Create a new rule to allow connections **only** from the IP addresses of your Vercel deployment. This prevents anyone from connecting to the database from an unauthorized location, even if they have the credentials.
-   **Note:** You will need to get the official outbound IP addresses for Vercel. For local development, you can temporarily add your local IP.

### 2.3. Review and Limit Postgres Role Privileges
With RLS disabled, the raw permissions of the default Supabase roles (`anon`, `authenticated`) become more critical. We should reduce their privileges to the absolute minimum.

-   **Action:** Run `REVOKE` commands to remove `SELECT`, `INSERT`, `UPDATE`, `DELETE` permissions on all public tables from the `anon` and `authenticated` roles. The only role that should have these permissions is the service role used by Drizzle (`postgres` or `service_role`), whose credentials should never be exposed.
-   **Example SQL:**
    ```sql
    REVOKE ALL PRIVILEGES ON TABLE public.clients FROM anon, authenticated;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    ```
-   **Verification:** Use Supabase's SQL editor to run a query as the `authenticated` role (e.g., `SET ROLE authenticated; SELECT * FROM public.clients;`) and confirm it fails due to lack of permissions.

### 2.4. Verify Secrets Management
-   **Action:** Ensure that the `DATABASE_URL` and any other sensitive credentials are only stored in server-side environment variables (`.env.local` for development, Vercel environment variables for production).
-   **Verification:** Double-check that no secrets are prefixed with `NEXT_PUBLIC_`, which would expose them to the client-side.
-   _Implementation note (2025-11-08):_ The Drizzle bootstrap (`lib/db/index.ts`) and CLI config (`drizzle.config.ts`) read from `.env.local` first, then `.env`. Keep those files present locally to avoid runtime errors.

---

## 3. Verification & Testing Strategy

This strategy uses a combination of automated and manual checks to ensure our new application-level authorization logic is flawless.

### 3.1. Authorization Integration Test Suite
-   **Action:** Create a dedicated suite of integration tests specifically for authorization. These tests should **not** mock the database; they should run against a real test database.
-   **Test Scenarios:** For each critical entity (`client`, `project`, `task`):
    -   **As an Admin:** Verify that you can perform all CRUD operations.
    -   **As a Client/Contractor:**
        -   Verify you **can** access data you own or are a member of.
        -   Verify you **cannot** access data belonging to other clients. This is the most critical test. Attempt to fetch, update, or delete another client's resources by guessing their IDs. The test must assert that a `403 Forbidden` error is returned.
    -   **As an Unauthenticated User:** Verify that any attempt to access protected API endpoints results in a `401 Unauthorized` error.

### 3.2. Manual Verification Checklist
-   **Action:** Perform a manual "mini penetration test" by actively trying to break the authorization logic.
-   **Checklist:**
    1.  Log in as a standard (non-admin) user.
    2.  Navigate to a URL for a resource you own (e.g., `/dashboard/clients/[your-client-id]`). Note the URL structure.
    3.  Manually change the ID in the URL to an ID belonging to another client. The application should immediately return a "Not Found" or "Access Denied" page.
    4.  Using browser dev tools, try to replay API requests made by the application, but substitute IDs in the request payload or URL with IDs you shouldn't have access to. Confirm each request fails with a `403` or `404` status code.
    5.  Attempt to access admin-only pages or API endpoints. Confirm you are redirected or receive an error.

### 3.3. Final Security Code Review
-   **Action:** Before deploying to production, conduct a final code review with a singular focus: security.
-   **Review Goal:** For every single data-access function created in `lib/queries/`, confirm that it is preceded by a call to an authorization helper function (`isAdmin`, `isClientMember`, etc.). There should be **zero** data-access functions that do not first verify the acting user's permissions.
