---
applyTo: '**'
---

# **Technical Specifications & Requirements**

## **0. LLM Implementation Workflow**

* **Read First:** Inspect this file, open issues, and recent commits before making changes. Confirm there are no conflicting high-priority tasks.
* **Clarify Scope:** Summarize the requested change in your own words and highlight unknowns back to the user before coding anything significant.
* **Design Before Code:** Propose the approach (data flow, component ownership, API shape) and wait for approval when impact is medium or higher.
* **Reuse > Rebuild:** Prefer existing modules, utilities, and shadcn components. Flag gaps before introducing new abstractions.
* **Guardrails:** Do not edit `package.json`, lockfiles, or Supabase migrations directly. Use the prescribed CLIs when dependencies or schema changes are required.
* **Verification:** Run linting, type-checking, and targeted tests for any touched surface. Share command results or blockers with the user.
* **Documentation:** Update or create README snippets, inline comments, and changelog notes whenever behavior or interfaces shift.

## **1. Technical Stack**

### **1.1 Core Technologies**

* **Version Control:** Git with GitHub
* **Package Manager:** npm
* **Runtime Environment:** Node.js (LTS)
* **Language:** TypeScript (strict mode)
* **Framework:** Next.js (App Router)
* **UI Components:** shadcn
* **Styling:** Tailwind CSS
* **Form Management:** React Hook Form
* **Schema Validation:** Zod
* **State Management & Data Fetching:** React Query
* **Charting Library:** Recharts
* **Rich Text Editor:** TipTap

### **1.2 Platform Services**
* **Deployment & Hosting:** Vercel
* **Serverless Backend:** Vercel Functions
* **Analytics:** Vercel Analytics
* **Cron Jobs:** Vercel Cron Jobs
* **AI Services:** Vercel AI Gateway
* **Errors & Monitoring:** Sentry
* **Database:** Supabase Postgres with pg\_vector
* **Authentication & Authorization:** Supabase Auth (role-based)
* **File Storage:** Supabase Storage
* **Queues & Background Jobs:** Supabase Queues
* **Email Service:** Resend

### **1.3 Tooling & Testing**
* **Linting:** ESLint with eslint-config-next, eslint-plugin-react, eslint-plugin-react-hooks, and Tailwind plugin
* **Formatting:** Prettier (project config)
* **Unit & Integration Tests:** Vitest + Testing Library (React)
* **End-to-End Tests:** Playwright
* **Static Analysis:** TypeScript `tsc --noEmit`, optional `spectral` or custom scripts when available

## **2. Development Practices**

* **Modular Architecture:** Group features by domain inside `src/app` and `src/components`. Shared utilities live under `src/lib` or `src/hooks`.
* **Git Hygiene:** Create topic branches, use conventional commit messages, and keep PRs scoped to a single feature or bug fix.
* **Performance Mindset:** Prefer server components where possible, defer client components, leverage caching headers, and use `next/dynamic` for heavy widgets.
* **API Design:** Follow RESTful patterns, version endpoints under `/api/v{n}`, return typed responses, and document request/response contracts in `docs/apis`.
* **Error Handling & Resiliency:** Wrap external calls with React Query retry policies, fail gracefully with sensible fallbacks, and log structured errors to Sentry.
* **Type Safety:** Avoid `any`; model domain data with shared TypeScript types and Zod schemas to keep server-client parity.
* **Dependency Management:** Install new packages via `npm install <package>@latest` and record rationale in PRs. Remove unused deps promptly.
* **Component Strategy:** Use `npx shadcn@latest add <component>` before building custom UI. Extend via composition rather than heavy overrides.
* **Database Workflow:** Manage schema updates via Supabase CLI migrations. Describe migration intent and run diff checks when applicable.
* **Secrets & Config:** Reference environment variables through `process.env` with typed helpers in `src/lib/utils.ts`. Never hardcode secrets.
* **RBAC Implementation:** Enforce role-based access control both at the Supabase level and within application logic to protect sensitive data and actions.

## **3. Non-Functional Requirements**

* **UI/UX:** Maintain a clean, professional aesthetic using the default shadcn theme. Favor consistent spacing, typography, and interactive states sourced from Tailwind design tokens.
* **Responsiveness:** Support 320px+ viewports with mobile-first layouts, accessible navigation, and no horizontal scroll.
* **Accessibility:** Meet WCAG 2.1 AA. Provide keyboard access, ARIA labels when semantic HTML is insufficient, focus outlines, and respect `prefers-reduced-motion`.
* **Performance:** Target Core Web Vitals (LCP < 2.5s, FID < 100ms, CLS < 0.1). Use lazy loading, image optimization, and caching headers. Track metrics in Vercel Analytics.
* **Security:** Sanitize all inputs, escape user-generated content, enable CSP headers, throttle sensitive endpoints, and follow OWASP Top 10 guidance.
* **Loading & Empty States:** Use skeletons or shimmer placeholders for async content, and provide helpful empty/error states to reduce bounce.
* **SEO & Social:** Supply descriptive metadata via Next.js head utilities, configure Open Graph tags, and ensure critical pages are crawlable.
* **Localization:** Structure copy for future i18n support by centralizing strings and avoiding inline literals where reasonable.

## **4. Observability & Operations**

* **Logging:** Emit structured logs with context (user id, request id) for server actions. Redact sensitive data before logging.
* **Monitoring:** Configure Sentry performance traces for slow APIs and capture breadcrumb data for client errors.
* **Feature Flags:** Introduce guarded rollouts via Supabase or environment toggles to de-risk large changes.
* **Metrics:** Track key product metrics (search success, invite completion) and document dashboards under `docs/reports`.

## **5. Environment, Deployment & Data**

* **Environment Parity:** Maintain `.env.example` with required variables, noting default or mock values for local use.
* **Deployment Workflow:** Favor trunk-based releases via Vercel previews. Merge only after automated checks pass.
* **Caching & CDN:** Utilize Vercel caching directives and Supabase query caching when possible. Bust caches on data mutations.
* **Data Privacy:** Comply with GDPR/CCPA by storing minimal PII, honoring deletion requests, and encrypting data in transit and at rest.
* **Backup & Recovery:** Document Supabase backup strategy and test restore procedures for critical tables.

## **6. Documentation & Knowledge Sharing**

* **Living Docs:** Update `docs/prds` and API references when behavior changes. Include diagrams for complex flows.
* **Developer Notes:** Add inline comments sparingly to explain non-obvious logic, especially around performance or security decisions.
* **Changelogs:** Record noteworthy updates (features, migrations, dependency bumps) in a shared changelog or release notes file.
