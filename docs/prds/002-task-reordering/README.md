# PRD: Task Reordering

- **Title:** Performant Task Reordering
- **Status:** Proposed
- **Author:** GitHub Copilot
- **Date:** 2025-11-04

## 1. Background

Currently, our application requires an efficient way to reorder tasks within columns. The existing or naive approaches, such as using an integer-based `order` column, often lead to poor performance, as reordering one task can trigger updates on many other tasks in the same list to maintain sequence. This PRD proposes a more performant strategy that minimizes database writes and ensures a scalable solution.

## 2. Problem Statement

When a user moves a task within a column, the application should update its position with minimal overhead. A simple integer-based ordering system would require re-calculating and updating the `order` field for all subsequent tasks in that column, which is inefficient and scales poorly with the number of tasks.

## 3. Proposed Solution: Lexical (String-Based) Ranking

To address this, we will implement a **Lexical (String-Based) Ranking** strategy. This method uses a `VARCHAR` or `TEXT` column (e.g., `rank`) to store the order of tasks. The rank is a string that is sorted alphabetically to determine the task's position.

This approach is highly performant because reordering a task only requires updating the `rank` of the single task that was moved.

### How it Works

1.  **Initial State:** Tasks are assigned a `rank` using simple alphabetical characters (e.g., "a", "b", "c").

2.  **Inserting Between Tasks:** To move a task between two others, we generate a new `rank` string that sorts alphabetically between its new neighbors.
    - To move a task between "a" and "b", its new rank could be "an".
    - To move a task between "an" and "b", its new rank could be "ao".

3.  **Handling Edge Cases (No Space):** If we need to insert an item between two very close ranks (e.g., "ax" and "ay"), we can simply append more characters to create a new valid rank (e.g., "axa"). This allows for virtually infinite precision.

4.  **Moving to Start/End:**
    - To move a task to the beginning of the list, we find the rank of the first item (e.g., "a") and generate a lexicographically smaller rank (e.g., by prepending a character, like "`a`").
    - To move a task to the end, we find the rank of the last item (e.g., "z") and generate a larger rank (e.g., "z`").

## 4. Technical Implementation

### 4.1. Database Schema

The `tasks` table will be updated to include a `rank` column.

```sql
ALTER TABLE tasks
ADD COLUMN rank VARCHAR(255) NOT NULL DEFAULT '';

-- It is recommended to add an index for faster sorting
CREATE INDEX idx_tasks_rank ON tasks(rank);
```

### 4.2. API Changes

A new API endpoint will be created to handle task reordering.

**Endpoint:** `PATCH /api/tasks/{taskId}/reorder`

**Request Body:**

```json
{
  "newRank": "an"
}
```

The logic for generating the `newRank` will reside on the client-side to keep the backend stateless and simple. The client will determine the ranks of the source task's new neighbors and compute the new rank before sending the update.

### 4.3. Frontend Implementation

- The frontend will use a library like `dnd-kit` for drag-and-drop functionality.
- A visual placeholder will be displayed to indicate the drop target, making it clear where the task will land.
- The drop zones at the beginning and end of the list will be clearly defined and easy to target, ensuring a smooth user experience when moving tasks to edge positions.
- When a task is dropped in a new position, the frontend will:
  1.  Get the `rank` of the item before the drop position (`prevRank`).
  2.  Get the `rank` of the item after the drop position (`nextRank`).
  3.  Calculate the `newRank` using a utility function.
  4.  Call the `PATCH /api/tasks/{taskId}/reorder` endpoint with the `newRank`.
  5.  On success, update the local state to reflect the new order.

## 5. Success Metrics

- **Performance:** Task reordering operations should complete in under 200ms.
- **Scalability:** The system should handle columns with 1,000+ tasks without noticeable degradation in performance.
- **Reliability:** The reordering logic should be resilient and free of race conditions or ordering conflicts.

## 6. Risks and Considerations

- **Rank Generation Logic:** The client-side logic for generating ranks must be robust to handle all edge cases, including moving items to the beginning or end of a list.
- **Initial Rank Assignment:** When creating a new task, it should be assigned a rank that places it at the end of its column by default.
- **Precision and String Length:** While string-based ranks offer high precision, there is a theoretical limit to the length of the `VARCHAR` column. This is unlikely to be an issue in practice.
