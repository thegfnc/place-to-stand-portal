# Phase 2: Settings & Server-Side Pagination

This phase focuses on eliminating the "snapshot" pattern in settings pages and introducing robust server-side pagination.

---

### 2.1. Refactor Settings "Snapshot" Queries

- **Files to Modify:**
  - `lib/queries/clients.ts` -> `getClientsSettingsSnapshot`
  - `lib/queries/projects.ts` -> `getProjectsSettingsSnapshot`
  - `lib/queries/hour-blocks.ts` -> `getHourBlocksSettingsSnapshot`
  - `app/(dashboard)/settings/clients/page.tsx`
  - `app/(dashboard)/settings/projects/page.tsx`
  - `app/(dashboard)/settings/hour-blocks/page.tsx`

- **Problem:** The settings pages for Clients, Projects, and Hour Blocks fetch the _entire_ content of their respective tables, including all relations, in a single "snapshot." This data is then filtered, sorted, and paginated on the client. This pattern is not scalable and will fail as data grows.

- **Solution:**
  1.  **Introduce Paginated Queries:** For each snapshot function, create a new paginated version (e.g., `listClientsForSettings`, `listProjectsForSettings`).
  2.  These new functions must accept pagination arguments (e.g., `limit`, `offset` or `cursor`) and filter/search parameters.
  3.  The functions should return both the data slice for the current page and the total count of records for the pagination controls.
      ```typescript
      // Example return type
      {
        items: ClientRow[],
        totalCount: number
      }
      ```
  4.  The queries should perform filtering, sorting, and pagination at the database level using `LIMIT`, `OFFSET`, and `WHERE` clauses.
  5.  **Refactor Settings Pages:**
      - Convert the settings pages (`clients/page.tsx`, etc.) to use URL state for pagination and filters (e.g., `?page=2&q=acme`).
      - Use search params to call the new paginated data functions.
      - Update the data tables (`ClientsSettingsTable`, etc.) to be "dumb" components that just render rows and emit events for page changes. The page component will handle the data fetching.

- **Acceptance Criteria:**
  - The snapshot functions are replaced with paginated queries.
  - Settings pages fetch only one page of data at a time.
  - Pagination, searching, and filtering are handled on the server.
  - Client-side data manipulation in settings pages is minimized.

---

### 2.2. Consolidate Users Settings Queries (Fix N+1)

- **Files to Modify:**
  - `app/(dashboard)/settings/users/page.tsx`
  - `lib/queries/users.ts`

- **Problem:** The Users settings page makes three separate database calls: one to list all users, and two more to get their client and task assignment counts. This is an N+1-style problem that can be solved with a single, more efficient query.

- **Solution:**
  1.  Create a new function in `lib/queries/users.ts` called `listUsersWithAssignmentCounts`.
  2.  This function will write a Drizzle query that:
      - Starts with the `users` table.
      - Performs a `leftJoin` on `clientMembers` and `taskAssignees`.
      - Uses `groupBy(users.id)`.
      - Selects the user fields along with aggregate counts: `sql<number>('count(client_members.id)')` and `sql<number>('count(task_assignees.id)')`.
  3.  Update `app/(dashboard)/settings/users/page.tsx` to call this single new function instead of the three separate ones.
  4.  Remove the client-side logic that manually stitches the counts together.

- **Acceptance Criteria:**
  - The Users settings page now loads all its data in a single database query.
  - The functions `getActiveClientMembershipCounts` and `getActiveTaskAssignmentCounts` are no longer called from this page.
  - The returned user objects include `clients_count` and `tasks_count` directly.

---

### 2.3. Add Pagination to Task Comments

- **Files to Modify:**
  - `lib/queries/task-comments.ts` -> `listTaskComments`
  - `app/(dashboard)/projects/_components/task-sheet/task-comments-panel.tsx`

- **Problem:** When a task has a large number of comments, `listTaskComments` fetches all of them at once, potentially slowing down the task sheet opening time.

- **Solution:**
  1.  Modify `listTaskComments` to accept pagination parameters (`limit`, `offset`/`cursor`).
  2.  The query should default to a reasonable page size (e.g., 20 comments).
  3.  Update the `TaskCommentsPanel` component to use `useInfiniteQuery` from TanStack Query.
  4.  Implement a "Load More" button in the UI that triggers `fetchNextPage` to load subsequent comment pages.

- **Acceptance Criteria:**
  - The task sheet initially loads only the first page of comments.
  - Users can load older comments by clicking a "Load More" button.
  - The API for task comments is now paginated.
