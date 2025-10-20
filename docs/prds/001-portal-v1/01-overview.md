# **PRD v1: Unified Client & Project Management System (MVP)**

**Document Status:** Done
**Version:** 1.0
**Date:** 2025-10-20
**Author:** GitHub Copilot

---

## **1. Introduction & Vision**

### **1.1. Problem Statement**
Client communication, project tracking, and billing are fragmented across multiple applications (email, chat, task managers, billing software). This creates inefficiencies for internal teams who must constantly switch contexts and manually aggregate data. For clients, it results in a lack of transparency regarding project status, progress, and billing. There is no single source of truth.

### **1.2. Project Goal & Vision**
The goal is to build a unified system that serves as a single source of truth for all client communication, project tracking, and billing.

The long-term vision is to create a seamless and transparent platform that enhances client relationships through self-service access to project information while empowering internal teams with centralized data, automated workflows, and powerful AI-driven insights.

### **1.3. Target Audience**
*   **Clients:** Seeking transparency, clear communication, and easy access to project status, and billing history.
*   **Internal Teams (Project Managers, Developers, Leadership):** Requiring a centralized hub to manage projects, track time, communicate efficiently, and monitor client health.

---

## **2. MVP Scope & Features**

The MVP is focused on delivering core functionality for client transparency and internal project management.

### **2.1. Core Components**

#### **2.1.1. Client Portal**
A secure, client-facing dashboard that provides a real-time view of their engagement.
*   **Project Status Dashboard:** Displays live project status, progress, and a burn-down visualization of purchased hours.
*   **Task & Ticket Management:**
    *   Clients can view current and completed tasks.
    *   Clients can submit new tickets/requests through a simple form.

#### **2.1.2. Internal Project Manager**
An internal-facing dashboard for managing all client projects.
*   **Unified Dashboard:** A high-level view of all active clients, projects, and team members.
*   **Project Tracking:**
    *   Track hours logged vs. hours purchased for each project.
    *   Manage task status (To Do, In Progress, Blocked, Done).
*   **Communication Log:**
    *   Manually log communication history with each client (e.g., upload meeting notes, paste email summaries).
*   **Permissions Layer:** A simple mechanism to distinguish between internal-only notes and information shared with the client.

### **2.2. MVP Deliverables**

*   **Lightweight Task Tracker:** An in-house task tracker to manage tasks and block-of-hours burn-down.
*   **Manual Data Entry:** All external data, such as meeting notes or important emails, will be manually entered or uploaded into the system.

---

## **3. User Stories**

### **3.1. Client User Stories**

*   **As a Client, I want to** log in and see a dashboard summarizing my outstanding tasks, **so that I** can quickly understand what requires my attention.
*   **As a Client, I want to** view all my work organized on a Kanban board under a "My Work" menu, **so that I** can easily track the status of every task.
*   **As a Client, I want to** see a burndown widget showing hours purchased, logged, and remaining for my project, **so that I** can monitor the budget and plan accordingly.
*   **As a Client, I want to** add a new task with a title and rich text description, **so that I** can submit new requests directly into the system.
*   **As a Client, I want to** add comments to an existing task, **so that I** can provide feedback or ask questions in context.
*   **As a Client, I want to** view a log of all activity on a task, **so that I** have a transparent history of who did what and when.
*   **As a Client, I should not be able** to change the status of a task on the Kanban board, **so that** project flow is managed by the internal team.

### **3.2. Contractor User Stories**

*   **As a Contractor, I want to** land on a "Home" dashboard showing a "My Tasks" widget, **so that I** can immediately see my assigned work across all projects.
*   **As a Contractor, I want to** see a list of only the clients I am assigned to, **so that I** can focus on my specific responsibilities.
*   **As a Contractor, I want to** switch between client projects using a simple combobox in the header, **so that I** can navigate efficiently without losing context.
*   **As a Contractor, I want to** manage tasks for a client on a Kanban board with columns for Backlog, On Deck, In Progress, Blocked, Awaiting Review, and Done, **so that I** can visually track and manage workflow.
*   **As a Contractor, I want to** drag and drop tasks between columns on the Kanban board, **so that I** can update task statuses quickly.
*   **As a Contractor, I want to** create a new task and edit existing ones using a form that slides out from the right, **so that I** can manage task details (like assignee, reviewer, and due dates) without leaving the main board view.
*   **As a Contractor, I want to** log time against a specific client or project, **so that** my work is accurately billed and contributes to the project burndown.
*   **As a Contractor, I want to** view a task's activity log, **so that I** can understand its history and see previous actions taken by the team or client.

### **3.3. Admin User Stories**

*   **As an Admin, I want to** see a list of all clients in the system, **so that I** have a complete overview of the business.
*   **As an Admin, I want to** perform all the same task and time management actions as a Contractor, **so that I** can support any project when needed.
*   **As an Admin, I want to** access a "Settings" area, **so that I** can manage core system data.
*   **As an Admin, I want to** manage clients, projects, users, and hour blocks through a simple table interface, **so that I** can handle all administrative CRUD operations.
*   **As an Admin, I want to** add or edit records using a consistent slide-out sheet, **so that** the data management experience is predictable.
*   **As an Admin, I want to** delete records from a table, but be prompted with a confirmation modal first, **so that I** can prevent accidental deletions.

---

## **4. System Architecture & Technical Design**

### **4.1. High-Level Architecture**

*   **Frontend:** A Next.js (React) application with role-based access control to serve both the Client Portal and the Internal Project Manager from a single codebase.
*   **Backend:** Serverless functions (Vercel Functions) handling authentication, business logic, and API requests.
*   **Database:** Supabase Postgres will be used as the primary data store. It will house the schemas for clients, projects, tasks, etc.

### **4.2. Data Model (High-Level Schema)**

*   `Clients`: (id, name, contact_info)
*   `Projects`: (id, client_id, name, status)
*   `Tasks`: (id, project_id, title, description, status, assignee_id, reviewer_id, due_date, doing_date)
*   `TimeLogs`: (id, task_id, user_id, hours_logged, date)
*   `Comments`: (id, task_id, user_id, content, created_at)
*   `ActivityLogs`: (id, user_id, action, target_type, target_id, details, created_at) - A polymorphic table to log various actions across the system (e.g., task status changes, project creation, comments).
    *   `target_type`: The type of entity the action was performed on (e.g., 'TASK', 'PROJECT', 'CLIENT').
    *   `target_id`: The ID of the associated entity.
    *   `action`: A code representing the action (e.g., 'STATUS_UPDATED', 'COMMENT_CREATED').
    *   `details`: A JSONB field to store contextual data, like the old and new values of a field.
*   `HourBlocks`: (id, project_id, hours_purchased, purchase_date)
*   `Users`: (id, name, email, role)

### **4.3. Information Architecture & UI/UX**

The application will be designed as a modern admin dashboard with a consistent and intuitive user interface.

*   **Layout:** A persistent sidebar on the left for primary navigation. The main content area will occupy the rest of the screen. Add/edit forms will slide out from the right side of the screen in a "Sheet" component, allowing users to maintain context.
*   **Home Dashboard:** Upon logging in, all users will land on a "Home" screen. Initially, this will contain a "My Tasks" widget. The design will be modular to accommodate additional persona-based widgets in the future.
*   **Client & Project Navigation:**
    *   A global "Client Switcher" combobox will be present in the header, allowing Admins and Contractors to quickly jump between different clients' projects.
*   **Deletion Pattern:** All delete actions will trigger a confirmation dialog to prevent accidental data loss. All deletions will be implemented as soft deletes.

#### **4.3.1. Role-Based Views**

**Admin & Contractor View:**

*   **Clients Menu:**
    *   Admins will see a list of all clients.
    *   Contractors will see a list of only the clients they are assigned to.
    *   The client detail view will feature a Kanban board to manage tasks.
    *   **Kanban Board Columns:** Backlog, On Deck, In Progress, Blocked, Awaiting Review, Done. The board will scroll horizontally.
    *   **Actions:** An "Add Task" button will be available. Contractors and Admins can also log time against the client/project from this view.
*   **Settings Menu (Admin Only):**
    *   Provides full CRUD (Create, Read, Update, Delete) functionality for:
        *   Clients
        *   Projects
        *   Users
        *   Hour Blocks
    *   Each section will display records in a read-only table with "Edit" and "Delete" buttons on each row and an "Add" button in the top-right corner.

**Client View:**

*   **My Work Menu:**
    *   Clients will see a Kanban board similar to the internal view, but scoped only to their assigned projects.
    *   **Permissions:** Clients can add new tasks and comment on existing tasks. They cannot change a task's status (i.e., drag and drop cards between columns).

#### **4.3.2. Core Components & Data**

*   **Task Details:**
    *   **Fields:** Title, Rich Text Description, Project, Assignee, Reviewer, Due Date, and "Doing" Date (start date).
    *   **Post-Creation Features:** A commenting system and a historical activity log (recording user, action, and timestamp) will be available on each task.
*   **Project Burndown Widget:**
    *   Each project will feature a widget displaying:
        *   Total hours purchased
        *   Total hours logged
        *   Remaining hours

### **4.4. Role-Based Access Control (RBAC)**
The system will be built with RBAC from the start to ensure data security and appropriate access levels for all users.

*   **Admin:**
    *   **Permissions:** Full read/write access across the entire system.
    *   **Capabilities:**
        *   Manage clients, projects, and user accounts (Contractors and Clients).
        *   Configure system settings.
        *   Access all data for all clients.

*   **Contractor (Internal Team Member):**
    *   **Permissions:** Limited to assigned projects.
    *   **Capabilities:**
        *   View and update tasks for projects they are assigned to.
        *   Log time against assigned tasks.
        *   Communicate with clients within the scope of their assigned projects.
        *   Cannot access projects they are not assigned to.

*   **Client (External User):**
    *   **Permissions:** Read-only access restricted to their own projects and data.
    *   **Capabilities:**
        *   View project status and task progress for their own projects.
        *   Submit new tickets/requests.
        *   Cannot see internal-only notes, other clients' projects, or any internal-facing system data.

---

## **5. Success Metrics**

### **5.1. Client-Facing Metrics**
*   **Client Portal Adoption:** % of active clients who log in at least once per week.
*   **Reduction in "Status Update" Emails:** A measurable decrease in emails from clients asking for project status.
*   **Client Satisfaction (CSAT):** A survey question presented in the portal: "How satisfied are you with the transparency of your project?"

### **5.2. Internal-Facing Metrics**
*   **Time Saved on Reporting:** Reduction in time spent by project managers manually compiling status updates and reports.
*   **Team Efficiency:** Reduction in time spent searching for information across different apps.

---

## **6. Future Enhancements (Post-MVP)**

*   **Google Workspace Integration:** Ingest email threads, meeting recordings, and documents for centralized search and summarization.
*   **Stripe Integration:** Sync payment status and display billing history to clients.
*   **AI & Automation Layer:** Introduce semantic search, automated summarization, and smart tagging.
*   **Email Threading & Classification:** Automatically categorize email threads into topics like "billing," "scope change," or "feature request."
*   **AI-Powered Notifications:** Automatically summarize meetings and send recap emails to both client and internal teams.
*   **Client "Health" Dashboard:** A predictive dashboard combining sentiment analysis, overdue tasks, payment status, and engagement level to flag at-risk accounts.
*   **Inline Chat:** A message thread or chat functionality tied to each project or task for real-time communication.
