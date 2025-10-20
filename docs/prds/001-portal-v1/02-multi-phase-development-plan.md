# **Multi-Phase Development Plan**

This document breaks down the Unified Client & Project Management System into a series of development phases. Each phase builds upon the last, ensuring a logical and incremental delivery of features.

---

## **Phase 1: Foundation & Core Internal Functionality**

**Objective:** Establish the project's technical foundation, including the database schema, user authentication, and core data management features for internal users (Admins and Contractors).

### **1.1. Technical Setup**
*   Initialize Next.js application with TypeScript, Tailwind CSS, and shadcn.
*   Set up Supabase for database, authentication, and storage.
*   Configure ESLint, Prettier, and other development tooling.
*   Implement basic environment variable management for secrets.

### **1.2. Database Schema (Initial)**
*   Create initial Supabase migrations for the following tables:
    *   `Users` (with roles: ADMIN, CONTRACTOR, CLIENT)
    *   `Clients`
    *   `Projects`
    *   `Tasks` (with core fields: title, description, status, etc.)
    *   `HourBlocks`
*   Implement soft-delete functionality on all relevant tables.

### **1.3. Authentication & Authorization**
*   Implement email/password login for all user roles.
*   Create middleware and server-side logic to enforce Role-Based Access Control (RBAC).
*   Build a basic sign-in page and logic to handle redirects upon successful login.

### **1.4. Admin Settings - CRUD**
*   Build the "Settings" section, accessible only to Admins.
*   Implement table views and slide-out sheet forms for full CRUD functionality for:
    *   **Users:** Create, view, edit, and (soft) delete users.
    *   **Clients:** Create, view, edit, and (soft) delete clients.
    *   **Projects:** Create, view, edit, and (soft) delete projects.
    *   **Hour Blocks:** Create, view, edit, and (soft) delete hour blocks associated with projects.
*   Ensure all "delete" actions have a confirmation modal.

### **1.5. Internal Task Management (Kanban)**
*   Develop the main project view for Admins and Contractors.
*   Implement the client switcher combobox in the header.
*   Build the horizontally-scrolling Kanban board with the specified columns (Backlog, On Deck, etc.).
*   Enable drag-and-drop functionality for Admins and Contractors to change task status.
*   Implement the "Add Task" and "Edit Task" functionality using the slide-out sheet.
*   Ensure Contractors can only see and interact with clients and projects they are assigned to.

---

## **Phase 2: Client Portal & Collaboration Features**

**Objective:** Build the client-facing portion of the portal and introduce features that facilitate communication and transparency.

### **2.1. Client "My Work" View**
*   Create the "My Work" menu item and view, accessible only to Client roles.
*   Implement the Kanban board for clients, reusing the component from Phase 1.
*   **Crucially:** Disable drag-and-drop functionality for clients.
*   Ensure clients can only see tasks related to their own projects.

### **2.2. Client Task & Commenting Capabilities**
*   Allow clients to use the "Add Task" button on their "My Work" board. The form should be simplified, perhaps only allowing Title and Description.
*   Implement the commenting system on the task details view/sheet.
*   Ensure users from all roles (Client, Contractor, Admin) can add and view comments on tasks they have access to.

### **2.3. Project Burndown Widget**
*   Develop the data model for `TimeLogs`.
*   Allow Admins and Contractors to log time against a project or task.
*   Create the "Burndown Widget" component.
*   Display the widget on both the internal project view and the client-facing "My Work" view, showing total hours purchased, logged, and remaining.

---

## **Phase 3: Dashboards, Activity Logs, & Refinements**

**Objective:** Enhance the user experience with summary dashboards and a comprehensive audit trail.

### **3.1. Polymorphic Activity Log**
*   Implement the `ActivityLogs` table with the polymorphic structure (`target_type`, `target_id`).
*   Integrate activity logging into all key system events:
    *   Task creation and status changes.
    *   Project creation/updates.
    *   New comments.
    *   Time logs.
    *   CRUD actions from the Settings panel.
*   Create a component to display the activity history on the relevant pages (e.g., within the task detail sheet).

### **3.2. Home Dashboard & "My Tasks" Widget**
*   Create the "Home" page that all users land on after login.
*   Develop the "My Tasks" widget, which should display a list of tasks assigned to the logged-in user.
*   Ensure the widget is functional for all roles (showing assigned tasks for Admins/Contractors and tasks requiring attention for Clients).

### **3.3. Final UI/UX Polish**
*   Conduct a full review of the application to ensure consistent styling, spacing, and component usage.
*   Verify all forms, buttons, and interactive elements follow the defined UI patterns (e.g., slide-out sheets, confirmation modals).
*   Ensure the application is responsive and accessible.

---

## **Future Enhancements (Post-MVP)**

*   **Google Workspace Integration:** Ingest email threads, meeting recordings, and documents.
*   **Stripe Integration:** Sync payment status and display billing history.
*   **AI & Automation Layer:** Introduce semantic search, automated summarization, and smart tagging.
*   **Inline Chat:** Add real-time messaging capabilities to projects or tasks.
*   **Client "Health" Dashboard:** A predictive dashboard to flag at-risk accounts.
