# 03: RLS Policy Analysis & Migration Strategy

- **Title:** RLS Policy Analysis for Drizzle Migration
- **Status:** Proposed
- **Author:** Jason Desiderio
- **Date:** 2025-11-08

---

## 1. Overview

This document analyzes the existing Row-Level Security (RLS) policies and defines how their logic will be translated into application-level checks within our new Drizzle-based data access layer. The core principle is to move authorization from the database to the application, making it explicit, testable, and co-located with our business logic.

The primary authorization mechanism relies on two concepts:
1.  **User Role:** A user can be an `ADMIN`, `CONTRACTOR`, or `CLIENT`.
2.  **Client Membership:** Non-admin users are granted access to resources based on their membership in the `client_members` table, which links a `user_id` to a `client_id`.

---

## 2. General Authorization Patterns

### `is_admin()`
- **RLS Logic:** The `public.is_admin()` function checks if the current user has the `ADMIN` role. This is used to grant blanket permissions on many tables.
- **Application-Level Strategy:** This will be replaced by a server-side helper function that checks the user's role from their Supabase Auth session claims or a query to the `users` table.

```typescript
// Example: lib/auth.ts
import { User } from '@supabase/supabase-js';

export function isAdmin(user: User): boolean {
  // Assuming 'ADMIN' role is stored in user metadata
  return user.user_metadata?.role === 'ADMIN';
}
```

### Client Membership (`user_is_client_member`)
- **RLS Logic:** Policies frequently check if a user is associated with a resource's parent `client` by looking for a corresponding entry in the `client_members` table.
- **Application-Level Strategy:** We will create a helper function that queries the `client_members` table. This function will be the cornerstone of our RBAC for non-admin users.

```typescript
// Example: lib/queries/clients.ts
import { db } from '@/lib/db';
import { clientMembers } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export async function isClientMember(userId: string, clientId: string): Promise<boolean> {
  const membership = await db.query.clientMembers.findFirst({
    where: and(
      eq(clientMembers.userId, userId),
      eq(clientMembers.clientId, clientId)
    ),
  });
  return !!membership;
}
```

---

## 3. Per-Table RLS Migration Plan

Below is a breakdown of the key tables and the plan for migrating their RLS policies.

### **`users`**
- **Current RLS:**
    - Users can view their own profile.
    - Admins can manage all users.
- **Application-Level Logic:**
    - `getUserById(actingUser, targetUserId)`:
        - If `isAdmin(actingUser)` or `actingUser.id === targetUserId`, proceed.
        - Otherwise, throw a 403 error.
    - `updateUser(actingUser, targetUserId, data)`:
        - If `isAdmin(actingUser)` or `actingUser.id === targetUserId`, proceed.
        - Otherwise, throw a 403 error.

### **`clients`**
- **Current RLS:**
    - Admins have full access.
    - Users can view clients they are a member of.
- **Application-Level Logic:**
    - `getClients(actingUser)`:
        - If `isAdmin(actingUser)`, return all clients.
        - Otherwise, return clients where the user is a member (`SELECT ... FROM clients c JOIN client_members cm ON c.id = cm.client_id WHERE cm.user_id = ...`).
    - `getClientById(actingUser, clientId)`:
        - Check if `isAdmin(actingUser)` or `await isClientMember(actingUser.id, clientId)`.
        - If false, throw a 403 error.

### **`projects`**
- **Current RLS:**
    - Admins have full access.
    - Users can view projects belonging to clients they are a member of.
- **Application-Level Logic:**
    - `getProjectById(actingUser, projectId)`:
        1. Fetch the project and its `clientId`.
        2. Check if `isAdmin(actingUser)` or `await isClientMember(actingUser.id, project.clientId)`.
        3. If false, throw a 403 error.

### **`tasks`**
- **Current RLS:**
    - Admins have full access.
    - Users can view and manage tasks within projects linked to clients they are a member of.
    - Only Admins can perform most modifications.
- **Application-Level Logic:**
    - `getTaskById(actingUser, taskId)`:
        1. Fetch the task, its project, and its client ID.
        2. Check if `isAdmin(actingUser)` or `await isClientMember(actingUser.id, task.project.clientId)`.
        3. If false, throw a 403 error.
    - `createTask(actingUser, data)`:
        1. Look up the `clientId` for the `projectId` in `data`.
        2. Check if `isAdmin(actingUser)` or (`await isClientMember(...)` and the user role is `CONTRACTOR`).
        3. If false, throw a 403 error.
    - `updateTask(actingUser, taskId, data)`:
        1. Fetch the task and its `clientId`.
        2. Check if `isAdmin(actingUser)`. Non-admins have limited update rights on tasks (e.g., adding comments, not changing status). The logic will need to be granular here.
        3. If not authorized for the specific change, throw a 403 error.

### **Other Tables (`task_comments`, `task_attachments`, `time_logs`, etc.)**
- The same pattern applies: these tables are typically linked to a `task`, `project`, or `client`. All data access functions for these child resources must first fetch the parent resource, check the user's membership on the parent's client, and deny access if the check fails (unless the user is an admin).
