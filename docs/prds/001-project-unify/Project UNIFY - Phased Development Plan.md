# **Project UNIFY: Phased Development Plan**

* **Version:** 3.0  
* **Status:** Phased Plan  
* **Date:** October 14, 2025

This document breaks the MVP into a logical, phased development plan to ensure a focused and iterative rollout.

## **Phase 1: Foundation & Core Internal Tools**

**Goal:** Build the essential backend infrastructure and the core tools for internal teams to manage projects and clients. This phase focuses on creating a functional internal system before exposing it to clients.

### **Key Deliverables:**

* **Infrastructure Setup:**  
  * Initialize Supabase project for database (Postgres) and authentication.  
  * Set up Next.js project and deploy to Vercel.  
  * Configure ESLint, Prettier, and TypeScript.  
* **Authentication & RBAC:**  
  * Implement user authentication (email/password) for all three roles (Internal Admin, Internal Worker, External Client).  
  * Create backend logic in Vercel Functions to enforce RBAC rules.  
* **Admin Functionality:**  
  * Build UI for Admins to create new clients, projects, and users.  
  * Implement functionality to add and manage blocks of hours for projects.  
* **Core Internal Worker Tools:**  
  * Develop the lightweight Kanban board with drag-and-drop functionality and the specified columns.  
  * Enable creation and editing of tasks with all required fields (Title, Description, Assignee, Reviewer, etc.).  
  * Implement the time-tracking feature against tasks.

## **Phase 2: Client Experience & Data Centralization**

**Goal:** Launch the client-facing portal and build the features necessary for centralizing all client-related data and communication history.

### **Key Deliverables:**

* **Client Portal Launch:**  
  * Build the read-only client dashboard (Project Status, Burn-down Bar).  
  * Implement the "Submit a New Request" form, which creates a task in the Backlog.  
  * Create the read-only view for billing history and shared documents.  
* **Data Ingestion & History:**  
  * Implement the manual asset attachment feature for internal users to add emails, docs, etc., to a project.  
  * Build the client-specific Activity Log panel to provide a complete audit trail of actions.  
* **Collaboration Features:**  
  * Implement the commenting and user-tagging (@ mention) system on tasks for internal users.

## **Phase 3: Intelligence Layer & Automation**

**Goal:** Enhance the platform's value by integrating AI-powered features for search and summarization, and begin automating data ingestion.

### **Key Deliverables:**

* **AI-Powered Search:**  
  * Set up pg\_vector in Supabase.  
  * Integrate with Vercel AI Gateway.  
  * Implement the unified semantic search bar for internal users.  
* **Initial Automation:**  
  * Build the pipeline for ingesting Google Workspace data (emails, meeting recordings).  
  * Create the automated transcription and summarization feature for meeting recordings.  
* **Polish & Refinement:**  
  * Address feedback from early users of Phase 1 and 2\.  
  * Implement skeleton loading states and optimize performance based on initial Core Web Vitals scores.  
  * Conduct a final accessibility audit (WCAG 2.1 AA).