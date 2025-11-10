# Phase 3: UI & Component-Level Optimizations

This phase addresses the remaining, more granular over-fetching issues tied to specific UI components.

---

### 3.1. Calendar View: Optimize Task Data

- **Files to Modify:**
  - `lib/data/projects/fetch-project-calendar-tasks.ts`
  - `app/api/v1/projects/[projectId]/calendar-tasks/route.ts`

- **Problem:** The project calendar view fetches tasks with their full relations, including all assignee records, full comment details (just for a count), and full attachment metadata (also just for a count). The UI only displays the task title, status, due date, and assignees.

- **Solution:**
  1.  Modify `fetchProjectCalendarTasks` to be much leaner.
  2.  **Task Selection:** Select only `id`, `title`, `status`, `due_on`, `deleted_at`.
  3.  **Assignees:** Select `user_id` and `deleted_at` only. The client can use this to derive the count and display avatars if needed (though the current UI doesn't).
  4.  **Counts via Aggregates:** Instead of joining `task_comments` and `task_attachments`, modify the query to get counts using subqueries or aggregates.
      ```sql
      -- Example of getting counts
      (SELECT COUNT(*) FROM task_comments WHERE task_id = tasks.id AND deleted_at IS NULL) as comment_count
      ```
      Update the Drizzle query to reflect this approach.
  5.  Ensure the `RawTaskWithRelations` type is replaced with a new, leaner `CalendarTask` type.

- **Acceptance Criteria:**
  - The calendar API response is significantly smaller.
  - It no longer contains full attachment or comment details.
  - Counts are calculated efficiently in the database.

---

### 3.2. Task Cards: Optimize Attachment Data

- **Files to Modify:**
  - `lib/data/projects/fetch-project-relations.ts`
  - `lib/queries/tasks.ts` -> `listProjectTasksWithRelations`

- **Problem:** Queries that populate the project board (`listProjectTasksWithRelations`, `fetchProjectRelations`) fetch the full metadata for every attachment on every task. The `TaskCard` component only displays the _count_ of attachments.

- **Solution:**
  1.  This is related to the Calendar fix. The main task fetching logic should use an aggregate count for attachments.
  2.  When fetching tasks for the board view, get the attachment count via a subquery.
  3.  The full attachment details should only be fetched when the `TaskSheet` is opened, using a separate, lazy-loaded query. The `use-task-attachments` hook inside the sheet is a good place for this.

- **Acceptance Criteria:**
  - The main project board data payload no longer contains arrays of attachment objects.
  - Each task object on the board has an `attachment_count` property.
  - Full attachment details are only fetched when a user opens a task.

---

### 3.3. Filter Soft-Deleted Records in Database

- **Files to Modify:**
  - `lib/data/projects/fetch-project-relations.ts`
  - `lib/queries/tasks.ts`

- **Problem:** Several queries fetch both active and soft-deleted records and then filter them on the client (e.g., `fetchProjectRelations` fetches all tasks, then `useProjectsTaskRefresh` splits them into active and archived).

- **Solution:**
  1.  Review all major data-fetching functions (`fetchProjectRelations`, `listProjectTasksWithRelations`, etc.).
  2.  Add `where(isNull(table.deletedAt))` to the queries by default, unless the specific function's purpose is to retrieve archived items (like for the "Archive" tab).
  3.  Create separate, specific functions for fetching archived content where needed, rather than fetching everything and filtering in code.

- **Acceptance Criteria:**
  - By default, queries only return active (non-deleted) records.
  - The amount of data sent over the wire is reduced by not including soft-deleted items unless explicitly requested.
  - Client-side filtering on `deleted_at` is eliminated.
