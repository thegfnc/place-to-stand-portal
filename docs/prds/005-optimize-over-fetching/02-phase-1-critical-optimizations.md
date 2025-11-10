# Phase 1: Critical Dashboard & Core Query Optimizations

This phase targets the most severe performance bottlenecks that affect everyday user experience.

---

### 1.1. Home Dashboard: Optimize `fetchAssignedTasks`

- **Files to Modify:**
  - `lib/data/tasks.ts`
  - `app/(dashboard)/home/page.tsx`
  - `lib/data/projects/fetch-project-relations.ts` (and its dependencies)

- **Problem:** The `My Tasks` widget on the home page triggers a massive data cascade via `fetchAssignedTasks` -> `fetchProjectsWithRelations`. It loads all accessible projects, clients, members, tasks (with all relations), time logs, and hour blocks, only to filter it all down to 12 task summaries on the client side. This is the single worst performance issue in the application.

- **Solution:**
  1.  Create a new, highly optimized query function named `fetchAssignedTasksSummary` in `lib/data/tasks.ts`.
  2.  This function should perform a single, targeted query. It will need to:
      - Join `tasks`, `task_assignees`, `projects`, and `clients`.
      - Filter with a `WHERE` clause: `task_assignees.user_id = $userId` and `task.deleted_at IS NULL`.
      - Apply the `ACTIVE_STATUSES` filter if `includeCompletedStatuses` is false.
      - Select **only** the required fields for the `AssignedTaskSummary` type:
        - `tasks`: `id`, `title`, `status`, `due_on`, `updated_at`, `created_at`
        - `projects`: `id`, `name`, `slug`
        - `clients`: `id`, `name`, `slug`
  3.  Implement sorting and limiting directly in the database query (`ORDER BY` and `LIMIT`).
  4.  Update `app/(dashboard)/home/page.tsx` to call this new `fetchAssignedTasksSummary` function instead of `fetchAssignedTasks`.
  5.  The old `fetchAssignedTasks` function, which relies on `fetchProjectsWithRelations`, should be marked as deprecated or removed if it is no longer used elsewhere.

- **Acceptance Criteria:**
  - The Home Dashboard now loads its data from the new, efficient `fetchAssignedTasksSummary` query.
  - The `fetchProjectsWithRelations` firestorm is no longer triggered on home page load.
  - The database query for the "My Tasks" widget returns a maximum of 12 rows with only the necessary columns.

---

### 1.2. Time Logs: Implement Lazy Loading & Aggregates

- **Files to Modify:**
  - `lib/data/projects/fetch-project-relations.ts`
  - `lib/queries/time-logs.ts`
  - `app/(dashboard)/projects/_components/project-burndown-widget.tsx`
  - `app/(dashboard)/projects/_components/project-time-log-history-dialog.tsx`

- **Problem:** `fetchProjectRelations` eagerly fetches every time log for all loaded projects, even though this data is only used in two places: an aggregated burndown widget and a dialog that shows a paginated list of 10 logs.

- **Solution:**
  1.  **Remove Eager Loading:** Modify `fetchProjectRelations` to **stop** fetching time logs entirely. Remove the call to `getTimeLogsForProjects`.
  2.  **Create Aggregate Query for Burndown:**
      - In `lib/queries/time-logs.ts`, create a new function `getSumOfHoursForProject(projectId: string)`.
      - This function should execute a Drizzle query equivalent to: `SELECT SUM(hours) as total FROM time_logs WHERE project_id = $projectId AND deleted_at IS NULL`.
      - Update the `ProjectBurndownWidget` and its data pipeline to use this new aggregate query instead of summing fetched rows.
  3.  **Lazy Load for History Dialog:**
      - The `ProjectTimeLogHistoryDialog` already uses `listProjectTimeLogs`, which is a paginated query. This is good.
      - Ensure the component (or its parent) is responsible for fetching this data via a React Query `useQuery` hook that is only enabled when the dialog is open. The data should not be pre-fetched with all other project relations.

- **Acceptance Criteria:**
  - Loading the main projects board no longer fetches any rows from the `time_logs` table.
  - The burndown widget is populated using a fast, server-side aggregate query.
  - A paginated API call for time logs is only made when the user explicitly opens the "Time Log History" dialog.

---

### 1.3. Task Comments: Trim Joined User Data

- **Files to Modify:**
  - `lib/queries/task-comments.ts`

- **Problem:** The `listTaskComments` function joins the `users` table and selects the entire user record for each comment's author. The UI only uses the author's `fullName` and `avatarUrl`.

- **Solution:**
  1.  In `lib/queries/task-comments.ts`, modify the `select` clause within `listTaskComments` and other relevant functions.
  2.  Change the `author` selection from the full user object to a lean object containing only the required fields:

      ```typescript
      // From
      author: { id, email, fullName, role, avatarUrl, createdAt, updatedAt, deletedAt }

      // To
      author: { id: users.id, fullName: users.fullName, avatarUrl: users.avatarUrl }
      ```

  3.  Adjust the `mapUserToDbUser` and related type definitions to reflect this leaner structure. The goal is to stop fetching `email`, `role`, `createdAt`, `updatedAt`, and `deletedAt` for every comment.

- **Acceptance Criteria:**
  - The API response for task comments now includes a minimal author object (`id`, `fullName`, `avatarUrl`).
  - Unused user fields are no longer queried or sent to the client.
