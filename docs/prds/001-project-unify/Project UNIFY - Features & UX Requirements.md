# **Project UNIFY: Features & UX Requirements**

* **Version:** 3.0  
* **Status:** Phased Plan  
* **Date:** October 14, 2025

This document details all user-facing requirements, including personas, user stories, scope, and design specifications.

## **1\. User Personas & Target Audience**

* **Sam (The Admin) \- Internal Admin:** Responsible for platform health, onboarding clients, managing users, and setting up projects.  
* **Alex (The Software Engineer) \- Internal Worker:** Works on client projects, manages tasks on the Kanban board, and logs time.  
* **Claudia (The Client) \- External Client:** Needs a transparent view of project progress, budget, and a simple way to submit requests.

## **2\. MVP Features & User Stories**

### **For the Admin (Sam)**

* **EPIC: User & Project Management**  
  * **Story:** As an Admin, I want to invite internal and client users and assign roles.  
  * **Story:** As an Admin, I want to create new clients and projects.  
  * **Story:** As an Admin, I want to add blocks of hours bought by a client to a specific project.

### **For the Internal Worker (Alex)**

* **EPIC: Lightweight Kanban Board**  
  * **Story:** As an Internal Worker, I want a Kanban board with columns: Backlog, On Deck, In Progress, Blocked, Awaiting Review, Done.  
  * **Story:** As an Internal Worker, I want to create, edit, delete, and drag-and-drop tasks.  
  * **Story:** As an Internal Worker, I want to add comments and @ tag other users on tasks.  
  * **Task Card Requirements:** Fields must include: Title, Rich Text Description, Project, Assignee, Reviewer, Due Date, and "Doing" Date.  
* **EPIC: Time Tracking**  
  * **Story:** As an Internal Worker, I want to track time against a specific task to burn down the project budget.  
* **EPIC: Unified Command Center**  
  * **Story:** As an Internal Worker, I want a unified search bar for all project-related assets.  
  * **Story:** As an Internal Worker, I want to manually attach assets (emails, docs) to a client/project.  
* **EPIC: Client Activity Log**  
  * **Story:** As an Internal Worker, I want a chronological, auditable activity log for each client, showing all actions by user and project.  
* **EPIC: AI-Powered Automation**  
  * **Story:** As an Internal Worker, I want meeting recordings automatically transcribed and summarized.

### **For the Client (Claudia)**

* **EPIC: Project Dashboard**  
  * **Story:** As a Client, I want a dashboard with project status, a burn-down bar, and active tasks.  
  * **Story:** As a Client, I want to view my billing history and shared documents.  
* **EPIC: Self-Service Actions**  
  * **Story:** As a Client, I want a simple form to submit new requests/tickets.

## **3\. Scope**

### **In Scope for MVP**

* Client Portal, Internal Dashboard, Time Tracking, Kanban Board, Activity Log, Manual Billing.  
* Google Workspace Integration (read-only).  
* AI-powered semantic search and summarization.

### **Out of Scope for MVP**

* Automated billing/payments, real-time chat, client visibility of internal comments, advanced "Client Health" dashboards, native mobile app.

## **4\. UX & Design Requirements**

* **Source of Truth:** UI/UX will be based on the existing homepage design.  
* **Design System:** Use the default Tailwind CSS design system for undefined tokens.  
* **Key User Flows:** High-fidelity wireframes are required for:  
  1. Admin inviting a new user.  
  2. Client Onboarding & First Login.  
  3. Client Dashboard View.  
  4. Client Ticket Submission Flow.  
  5. Internal Worker Unified Search Experience.  
  6. Internal Worker interaction with the Kanban Board.  
  7. Viewing a client's activity log.

## **5\. Home Dashboard Layouts**

### **For Sam (The Admin)**

* **Layout:** Three-column view with "Quick Actions," a "Project Overview" list, and a global "Activity Feed."

### **For Alex (The Internal Worker)**

* **Layout:** Two-column view with "My Work" (tasks, projects) and "Context & Collaboration" (mentions, log time button).

### **For Claudia (The Client)**

* **Layout:** Single-column view with "Key Metrics" (status, burn-down bar), "Current Work," and "Resources."