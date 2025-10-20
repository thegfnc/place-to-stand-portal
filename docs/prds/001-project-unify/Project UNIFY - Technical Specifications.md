# **Project UNIFY: Technical Specifications**

* **Version:** 3.0  
* **Status:** Phased Plan  
* **Date:** October 14, 2025

This document outlines the architecture, technology stack, and other non-functional requirements for Project UNIFY.

## **1\. Role-Based Access Control (RBAC)**

* **Internal Admin:** Full super-user privileges.  
* **Internal Worker:** Standard user with access only to assigned projects.  
* **External Client:** Read-only access to their own account data only.

## **2\. Technical Architecture & Stack**

* **Language:** TypeScript  
* **Framework:** Next.js (App Router)  
* **UI Components:** shadcn/ui  
* **Styling:** Tailwind CSS  
* **Form Management:** React Hook Form  
* **Schema Validation:** Zod  
* **Deployment & Hosting:** Vercel  
* **Database & Auth:** Supabase (Postgres & Auth)  
* **Vector Database:** pg\_vector via Supabase  
* **Serverless Backend:** Vercel Functions  
* **Integrations & APIs:**  
  * Google Workspace (Gmail, Calendar, Drive APIs)  
  * LLMs via Vercel AI Gateway  
  * Email Service: Resend  
* **Analytics:** Vercel Analytics

## **3\. Development Practices**

* **Dependency Management:** package.json must only be modified via npm install \<package\>@latest.  
* **Linting:** ESLint with eslint-config-next, eslint-plugin-react, eslint-plugin-react-hooks.  
* **Code Formatting:** Prettier with a standard configuration.

## **4\. Non-Functional Requirements**

* **Performance:** Google PageSpeed score of 90+. Core Web Vitals: LCP \< 2.5s, FID \< 100ms, CLS \< 0.1.  
* **Responsiveness:** Fluid layout from 320px width upwards. No horizontal scrollbars.  
* **Accessibility:** WCAG 2.1 Level AA compliant. Respect prefers-reduced-motion.  
* **Security:** Sanitize all inputs to prevent XSS attacks.  
* **Loading States:** Use skeleton loading states for all async data to prevent CLS.

## **5\. Open Questions**

* What are the precise OAuth scopes we need from Google, and have they been vetted for security?  
* What is the defined process for handling transcription errors or inaccurate AI summaries?  
* What is the notification mechanism when a user is tagged in a comment (e.g., email, in-app notification)?