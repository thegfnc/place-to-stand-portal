# PRD-005: Optimize Over-fetching Across the Application

## 1. Overview

### 1.1. Problem Statement

A comprehensive audit of the application's data-fetching patterns has revealed critical over-fetching issues across several key features. Many UI components are triggering large, inefficient database queries that retrieve entire tables or unnecessarily wide rows with many unused columns and relations (e.g., tasks with full comments, attachments, and author profiles). This practice leads to poor initial page load times, high bandwidth consumption, increased database load, and a sluggish user experience, especially as the data scales.

### 1.2. Goal

The primary goal of this initiative is to systematically refactor our data-fetching logic to ensure that UI components query for **only the data they need to render**. This will significantly improve application performance, reduce server and database load, lower bandwidth costs, and create a faster, more responsive user experience.

### 1.3. Key Metrics for Success

-   **Reduced Payload Size:** API responses and server component data payloads should be smaller.
-   **Faster Query Execution:** Database query times should decrease.
-   **Fewer Rows Transferred:** Queries should select specific columns and use `LIMIT` clauses effectively, reducing the total number of rows transferred from the database.
-   **Improved Page Load Performance:** Core Web Vitals, particularly Largest Contentful Paint (LCP), should improve on affected pages like the Home Dashboard and Projects Board.

### 1.4. Implementation Strategy

This project will be implemented in three distinct phases to manage complexity and deliver value incrementally. Each phase targets a group of related issues, starting with the most critical performance bottlenecks.

-   **[Phase 1: Critical Dashboard & Core Query Optimizations](./02-phase-1-critical-optimizations.md)**: Address the most severe over-fetching issues on high-traffic pages like the Home Dashboard and the main Projects Board.
-   **[Phase 2: Settings & Server-Side Pagination](./03-phase-2-settings-and-pagination.md)**: Refactor the "snapshot" data-loading patterns in the admin settings sections, replacing them with efficient, paginated queries.
-   **[Phase 3: Component-Level & Granular Optimizations](./04-phase-3-ui-and-component-level-optimizations.md)**: Tackle remaining inefficiencies at the component level, such as in the Calendar, Task Attachments, and Activity Feeds.

## 2. General Requirements & Guardrails

-   **Authorization:** All new and modified data-fetching functions must continue to use the authorization guards from `lib/auth/permissions.ts`.
-   **Type Safety:** All new data shapes and API responses must be strictly typed. Update or create new TypeScript types as needed.
-   **No Breaking UI Changes:** The refactoring should not alter the visible UI, only the underlying data-fetching mechanism.
-   **Incremental Commits:** Each optimization should be implemented in a separate, logical commit to facilitate review.
