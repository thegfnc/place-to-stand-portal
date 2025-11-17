# CRM & Client Management Implementation Plan

This document outlines a phased development plan for implementing the features detailed in the [PRD](./index.md).

## Phase 1: Data Model & Backend Foundation

**Goal:** Implement all necessary database schema changes to support the new CRM functionalities. This phase is foundational and must be completed before any frontend work begins.

**Tasks:**

1.  **Update `projects` Table:**
    - Add `is_personal` (boolean, default `false`).
    - Add `is_internal` (boolean, default `false`).
    - Modify `client_id` to be nullable.
    - Implement the database check constraint for data integrity.
2.  **Update `clients` Table:**
    - Add `billing_type` (enum: `'prepaid' | 'net_30'`, default `'prepaid'`).
3.  **Create `task_assignee_metadata` Table:**
    - Schema: `task_id`, `user_id`, `sort_order`.
    - This table will store user-specific sort orders for the "My Tasks" view.
4.  **Create `leads` Table:**
    - Define the schema as specified in the PRD (name, status, source, value, owner, etc.).
5.  **Drizzle Migrations:**
    - Run `npm run db:generate` to create the migration files based on the schema changes.
    - Review the generated SQL to ensure correctness.
    - Run `npm run db:migrate` to apply the changes to the database.

## Phase 2: "My Tasks" Feature Implementation

**Goal:** Build the dedicated "My Tasks" page and integrate it into the homepage widget.

**Tasks:**

1.  **Backend API:**
    - Create a new server action or API endpoint to fetch all tasks assigned to the currently authenticated user.
    - The query must filter out `Archived` and `Accepted` tasks.
    - It should join with the `task_assignee_metadata` table to respect the user's custom sort order.
2.  **Frontend Page:**
    - Create the new page component at `/my-tasks`.
    - Add a link to the main sidebar under "Home".
3.  **UI Implementation:**
    - Build the Kanban board view for task management.
    - Build the Calendar view to show tasks by due date.
    - Ensure task cards prominently display the associated **Client Name** and **Project Name**.
4.  **Homepage Widget:**
    - Update the existing "My Tasks" widget to link to the new page.
    - Add the "See All" button and the total task count to the widget header.

## Phase 3: Client Management Feature Implementation

**Goal:** Create the new dedicated section for viewing and managing clients.

**Tasks:**

1.  **Navigation:**
    - Add a "Clients" link to the "Work" section of the sidebar.
2.  **Client Landing Page (`/clients`):**
    - Develop an API endpoint to list all clients (with pagination).
    - Create a grid of client cards, reusing existing project card styles where appropriate.
    - Implement the quick switcher for easy navigation between clients.
3.  **Client Detail Page (`/clients/[clientId]`):**
    - Develop API endpoints to fetch a single client's details and their associated projects.
    - Display the client's information.
    - Upgrade the `notes` field from a simple textarea to the full Rich Text Editor component.
    - Display a grid of the client's projects below their details.

## Phase 4: Sales & Leads Pipeline Implementation

**Goal:** Build the Kanban-style sales pipeline to track leads.

**Tasks:**

1.  **Navigation:**
    - Add a new "Sales" section to the sidebar with a "Leads" link.
2.  **Backend API:**
    - Create server actions to handle all CRUD operations for leads (Create, Read, Update, Delete).
    - The "Read" action should fetch all leads and group them by status for the Kanban view.
3.  **Leads View (`/leads`):**
    - Build the Kanban board UI with the columns defined in the PRD (`New Opportunities`, `Active Opportunities`, etc.).
    - Implement drag-and-drop functionality to allow users to move leads between columns, which will update the lead's status.
4.  **Lead Management:**
    - Implement the lead creation and editing forms within a sheet component, similar to the existing task UI.

## Phase 5: Finalization & Verification

**Goal:** Implement analytics, document the work, and prepare for manual testing.

**Tasks:**

1.  **Analytics:**
    - Implement all analytics events specified in the PRD using PostHog.
    - Confirm that the events are firing correctly in the PostHog dashboard.
2.  **Documentation:**
    - Maintain the `PROGRESS.md` file throughout the implementation, documenting decisions, completed tasks, and any blockers.
3.  **Manual Testing:**
    - Follow the manual QA plan outlined in the PRD.
    - Create a separate manual testing guide with step-by-step instructions for each key user flow.
