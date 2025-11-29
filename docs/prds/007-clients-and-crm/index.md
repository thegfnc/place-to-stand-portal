---
title: '007: Clients & CRM'
status: 'draft'
author: 'Jason Desiderio'
date: '2025-11-17'
---

# 007: Clients & CRM

## 1. Overview

This document outlines the requirements for enhancing the portal with client management and CRM functionalities. The goal is to provide better task organization for users, introduce more sophisticated project and client categorization, create a dedicated client management interface, and add a new sales pipeline for lead tracking.

## 2. "My Tasks" Page

A dedicated page for users to manage their assigned tasks across all projects.

### 2.1. Requirements

- **New Page:** Create a new page accessible at `/my-tasks`.
- **Sidebar Navigation:** Add a link in the main sidebar under "Home" titled "My Tasks".
- **Homepage Widget Integration:**
  - The existing "My Tasks" widget on the homepage should link to this new page.
  - The widget's header should contain a "See All" button linking to `/my-tasks`.
  - The widget will display a maximum of 5 tasks.
  - The header will also show a count of total assigned tasks (e.g., "5 of 23 tasks").
- **Views:**
  - **Kanban Board View:** A board view for task management.
  - **Calendar View:** A calendar view showing task due dates.
- **Task Cards:**
  - Task cards on both the board and in the widget should prominently display the associated **Client Name** and **Project Name**.
- **Custom Sorting:**
  - Users must be able to reorder tasks on their personal Kanban board.
  - This order should be independent of the project-level task order.
  - A new column, `assignee_sort_order`, will be added to the `tasks` table to store this user-specific ordering. The existing reordering logic will be adapted for this.
- **Filtering:**
  - The query for "My Tasks" (both the widget and the page) must filter out tasks with `status` set to `Archived` or `Accepted`.

### 2.2. Permissions & Access Control

A user should only be able to see tasks that are assigned to them.

### 2.3. API & Data Fetching Strategy

- A new server action or API endpoint will be created to fetch tasks assigned to the current user.
- It should support pagination.
- It should accept filter parameters (e.g., status).
- React Query will be used for caching and data fetching on the client-side.

### 2.4. UI/UX Considerations

- Standard shadcn components for skeletons (loading), empty, and error states should be used.

## 3. Data Model & Information Architecture

Proposals to address current limitations in how projects and clients are categorized and billed.

### 3.1. Personal & Internal Projects

**Problem:** "Fake clients" are currently used to represent personal and internal projects, cluttering the client list. Furthermore, the current schema requires all projects to be associated with a client.

**Proposed Solution:**

We will introduce a new `type` field to the `projects` table and make the `client_id` field nullable to properly categorize projects without needing a client record.

- **`type`** (enum, e.g., `'CLIENT' | 'PERSONAL' | 'INTERNAL'`, default `'CLIENT'`): This field will define the project's category.
- **`client_id`** (uuid, nullable): The `client_id` field will be modified to allow `NULL` values.

**Data Integrity Rule:**
A database check constraint or application-level validation will be implemented to enforce the following logic:

- If `type` is `PERSONAL` OR `type` is `INTERNAL`, then `client_id` **must** be `NULL`.
- If `type` is `CLIENT`, then `client_id` **must not** be `NULL`.

This approach removes the need for fake client records, ensures data integrity, and allows for cleaner separation of project types.

- **Personal Projects:** When `type` is `PERSONAL`, visibility will be restricted to the user specified in the `created_by` field.
- **Internal Projects:** When `type` is `INTERNAL`, these will be visible to all users in the organization.

#### 3.1.1. Task Sorting Implementation

The `assignee_sort_order` column on the `tasks` table is not suitable for multiple assignees. A better approach is to use a dedicated join table.

- **New Table:** `task_assignee_metadata`
  - `task_id` (uuid, FK to `tasks.id`)
  - `user_id` (uuid, FK to `users.id`)
  - `sort_order` (integer)
  - Primary Key: `(task_id, user_id)`

This join table approach is confirmed and will be used for user-specific task sorting.

`### 3.1.2. Project Creation & Editing UI

To support the new `type` field, the project creation and editing UI must be updated.

- **Form Updates:** The "Create Project" and "Edit Project" forms (likely a sheet or modal) will include a new radio group or dropdown to select the "Project Type":
  - "Client Project" (default)
  - "Personal Project"
  - "Internal Project"
- **Conditional Logic:**
  - By default, "Client Project" will be selected.
  - If either "Personal Project" or "Internal Project" is selected, the "Client" selection dropdown **must** be disabled and cleared. This enforces the data integrity rule that personal or internal projects cannot have an associated client.
  - The UI should provide a tooltip or helper text explaining why the client field is disabled when one of these options is selected.

### 3.2. Client Billing Models

**Problem:** The current system only supports prepaid clients. We need to accommodate legacy clients on a "Net 30" monthly billing cycle.

**Proposed Solution:**

Add a `billing_type` field to the `clients` table:

- `billing_type` (enum, e.g., `'prepaid' | 'net_30'`, default `'prepaid'`): This will allow us to differentiate clients and can be used in the future to build custom logic for invoicing and reporting.

## 4. Clients View

A new dedicated section for managing clients, replacing the legacy `/settings/clients` route and consolidating everything under `/clients`.

### 4.1. Requirements

- **Sidebar Navigation:**
  - Add a new item in the "Work" section of the sidebar titled "Clients", positioned above "Projects".
- **UI Structure:**
  - The main view should feature a quick switcher at the top for easy navigation between clients, similar to the projects view.
  - The layout should be tabbed, though initially, it will only contain one tab.
- **Client Landing Page (`/clients`):**
  - Display a grid of client cards.
  - Each card should show relevant information, mirroring the design of the project cards.
- **Client Detail Page (`/clients/[clientId]`):**
  - **Overview Tab:** A single tab to start.
  - **Client Information:** Display the fields currently managed in the client sheet form within `/clients`.
  - **Notes Field:** The `notes` text area should be upgraded to use the full Rich Text Editor (RTE) component.
  - **Projects Grid:** Below the client details, display a grid of projects associated with that client, reusing the existing project card component from the `/projects` page.

### 4.2. Permissions & Access Control

- All clients will be visible to all users.

### 4.3. API & Data Fetching Strategy

- Endpoints will be needed for:
  - Listing all clients (with pagination).
  - Fetching a single client's details.
  - Fetching all projects for a given client.
- React Query will be used for data fetching.

### 4.4. UI/UX Considerations

- Standard shadcn components for skeletons (loading) and empty states should be used.

## 5. Sales & Leads Pipeline

A new section to manage the sales pipeline and track potential new business.

### 5.1. Requirements

- **Sidebar Navigation:**
  - Create a new top-level section in the sidebar titled "Sales", positioned above "Work".
  - Under "Sales", add a new page link called "Leads".
- **Leads View:**
  - The view should be a Kanban board.
- **Kanban Columns:** The board should have the following columns to represent the sales funnel:
  - **New Opportunities:** Fresh leads that have not been qualified.
  - **Active Opportunities:** Qualified leads that are being actively engaged.
  - **Proposal Sent:** Leads to whom a proposal has been delivered.
  - **On Ice:** For leads that have gone unresponsive or have requested a follow-up at a later date. This keeps the "Active Opportunities" column clean and focused.
  - **Closed Won:** Deals that have been successfully closed.
  - **Closed Lost:** Opportunities that did not convert.

### 5.2. Data Model: `leads` table

> **Jason to complete:**
>
> What fields should a `lead` record contain? Here is a proposed schema. What is missing?
>
> - `id` (uuid, pk)
> - `name` (text, not null)
> - `status` (enum, maps to Kanban columns, not null)
> - `source` (text, nullable, e.g., "Referral", "Website")
> - `estimated_value` (numeric, nullable)
> - `owner_id` (uuid, FK to `users.id`, nullable)
> - `contact_email` (text, nullable)
> - `contact_phone` (text, nullable)
> - `notes` (jsonb, for RTE content)
> - `created_at` / `updated_at`

### 5.3. Permissions & Access Control

- The "Sales" section and "Leads" pipeline will be accessible to all users.

### 5.4. API & Data Fetching Strategy

- An endpoint will be needed to fetch all leads, organized by status for the Kanban view.
- Server actions will handle creating, updating, and reordering leads.

### 5.5. UI/UX Considerations

- Lead creation and editing will be handled in a sheet component, similar to the existing task management UI.
- Drag-and-drop functionality should be implemented for moving leads between columns.
- Standard shadcn components for skeletons (loading) and empty states should be used.

## 6. Observability & Analytics

The following analytics events should be tracked. These events should be implemented and confirmed in PostHog.

- `my_tasks_task_reordered`
- `clients_viewed`
- `client_details_viewed`
- `leads_board_viewed`
- `lead_created`
- `lead_status_changed`

## 7. Implementation & Testing Plan

### 7.1. Progress Documentation

The agent should maintain a `PROGRESS.md` file in this directory (`/docs/prds/007-clients-and-crm/`). This file will serve as a development log, documenting:

- Decisions made during implementation.
- Architectural choices and trade-offs.
- A running list of completed tasks.
- Any blockers or issues encountered.

### 7.2. Implementation Steps

1.  **Data Model:**
    - Create and apply Drizzle migrations for `projects`, `clients`, `leads`, and `task_assignee_metadata` tables.
    - Implement database constraints and seed data.
2.  **Backend:**
    - Develop server actions and API endpoints for each new feature.
    - Implement permission checks based on user roles.
3.  **Frontend:**
    - Build the UI components for each new page.
    - Integrate data fetching logic with React Query.
    - Implement UI/UX requirements (drag-and-drop, RTE, etc.).

### 7.3. Testing

- **Manual QA:** A manual testing plan will be provided to you to execute. Key areas to cover include:
  - Verify all UI states (loading, empty, error).
  - Test responsive behavior on mobile devices.
  - Confirm that permission rules are correctly enforced.
