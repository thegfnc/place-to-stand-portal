# 007: Clients & CRM - Progress Log

This document tracks the progress of the implementation of the features outlined in the [PRD](./index.md) and the [Development Plan](./PLAN.md).

## Phase 1: Data Model & Backend Foundation

- [ ] **Update `projects` Table** – Change from `is_personal`/`is_internal` booleans to a `type` enum (`CLIENT`, `PERSONAL`, `INTERNAL`) and enforce the integrity check.
- [x] **Update `clients` Table** – introduced the `billing_type` enum (`prepaid` | `net_30`) with a default of `prepaid`.
- [x] **Create `task_assignee_metadata` Table** – added the join table with composite primary key, cascading FKs, timestamps, and policies to prep per-user task ordering.
- [x] **Create `leads` Table** – implemented the approved schema (without `estimated_value`), including the `lead_status` enum and soft-delete friendly fields.
- [x] **Drizzle Migrations** – generated `0002_crm-phase-1.sql`. Applying the migration locally is blocked until a usable `DATABASE_URL` is available (current `.env.local` is unreadable in this environment).

## Phase 2: "My Tasks" Feature Implementation

- [x] **Backend API** – implemented `/api/my-tasks` (query) and `/api/my-tasks/reorder` (drag/drop persistence) backed by `task_assignee_metadata`.
- [x] **Frontend Page** – added the `/my-tasks` route that loads the new client dashboard experience with Tabs + React Query state.
- [x] **UI Implementation** – built the personalized Kanban board (with DnD + user-specific sort) and calendar view that reuses existing helpers for due-date display.
- [x] **Homepage Widget** – wired the widget to the new query, added total count + "See all" CTA, and improved metadata display.
- [x] **Board & Calendar Polish** – filtered backlog tasks from all My Tasks surfaces, reused the project board layout/columns (with contextual task cards), and enabled calendar drag/drop to persist due date changes via the shared task sheet APIs.

## Phase 3: Project Configuration UI

- [ ] **UI Updates**
- [ ] **Conditional Logic**

## Phase 4: Client Management Feature Implementation

- [ ] **Navigation**
- [ ] **Client Landing Page (`/clients`)**
- [ ] **Client Detail Page (`/clients/[clientId]`)**

## Phase 5: Sales & Leads Pipeline Implementation

- [ ] **Navigation**
- [ ] **Backend API**
- [ ] **Leads View (`/leads`)**
- [ ] **Lead Management**

## Phase 6: Finalization & Verification

- [ ] **Analytics**
- [ ] **Documentation**
- [ ] **Manual Testing**
