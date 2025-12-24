# Autonomous Bug-Fixing System - Product Requirements Document

**Version:** 2.0
**Date:** December 24, 2024
**Status:** Planning
**Owner:** Place to Stand Engineering

---

## Executive Summary

This document outlines the design and implementation plan for an **Autonomous Bug-Fixing System** - an enterprise-grade platform that enables AI agents (powered by Claude) to automatically receive bug reports from clients, analyze codebases, implement fixes, and create pull requests with minimal human intervention.

The system represents a paradigm shift from traditional bug-fixing workflows where developers manually triage, investigate, and fix issues. Instead, the only human touchpoint will be **reviewing and merging the pull request**.

---

## Existing Infrastructure (What We Can Reuse)

Before building new components, we have significant infrastructure already in place:

### Already Built (~40-50% of total system)

| Component | Location | Status | Reuse Strategy |
|-----------|----------|--------|----------------|
| **GitHub OAuth** | `lib/oauth/github.ts` | ✅ Complete | Extend for repo cloning |
| **Google OAuth** | `lib/oauth/google.ts` | ✅ Complete | Use for Gmail intake |
| **Token Encryption** | `lib/oauth/encryption.ts` | ✅ Complete | Use for all secrets |
| **GitHub Client** | `lib/github/client.ts` | ✅ Complete | Extend with git operations |
| **Gmail Sync** | `lib/email/sync.ts` | ✅ Complete | Pipe to bug intake |
| **Email Matching** | `lib/email/matcher.ts` | ✅ Complete | Reuse for bug→project linking |
| **PR Generation AI** | `lib/ai/pr-generation.ts` | ✅ Complete | Extend for fix PRs |
| **PR Suggestions** | `lib/data/pr-suggestions/` | ✅ Complete | Extend workflow |
| **Activity Logging** | `lib/activity/logger.ts` | ✅ Complete | Use for audit trail |
| **Webhook Pattern** | `app/api/integrations/leads-intake/` | ✅ Complete | Copy for bug intake |
| **Docker Setup** | `Dockerfile`, `docker-compose.yml` | ✅ Complete | Extend for workers |
| **Database Patterns** | `lib/db/schema.ts` | ✅ Complete | Follow same patterns |

### Needs to Be Built (~50-60% of total system)

| Component | Phase | Dependencies |
|-----------|-------|--------------|
| Job Queue System | Phase 0 | PostgreSQL (existing) |
| Bug Report Schema | Phase 2 | Database patterns (existing) |
| Codebase Knowledge Schema | Phase 1 | Database patterns (existing) |
| Codebase Analysis Agents | Phase 1 | GitHub client (existing), Claude API (new) |
| Bug Parsing Agent | Phase 2 | Email integration (existing), Claude API (new) |
| Execution Containers | Phase 3 | Docker (existing) |
| Agent Orchestration | Phase 4 | Codebase knowledge, Execution env |
| Validation Pipeline | Phase 5 | Execution env, GitHub client |
| Monitoring Dashboard | Phase 6 | All phases |

---

## Critical Dependencies & Phase Order

```
                    ┌──────────────────────────────────────────────────────────────┐
                    │                    EXISTING INFRASTRUCTURE                    │
                    │                                                               │
                    │  GitHub OAuth ─── GitHub Client ─── PR Suggestions           │
                    │       │                │                  │                   │
                    │  Google OAuth ─── Gmail Sync ─── Email Matching              │
                    │       │                │                  │                   │
                    │  Token Encryption ─ Activity Logging ─ Docker Setup          │
                    │                                                               │
                    └──────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                    ┌──────────────────────────────────────────────────────────────┐
                    │                 PHASE 0: JOB QUEUE (NEW)                      │
                    │           PostgreSQL-based queue (pg-boss or custom)          │
                    │                 Foundation for all async work                 │
                    └──────────────────────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                                                   │
                    ▼                                                   ▼
┌───────────────────────────────────────┐       ┌───────────────────────────────────────┐
│     PHASE 1: CODEBASE INTELLIGENCE    │       │     PHASE 2: BUG INTAKE               │
│                                       │       │                                       │
│  Dependencies:                        │       │  Dependencies:                        │
│  ├─ GitHub OAuth (existing)          │       │  ├─ Google OAuth (existing)           │
│  ├─ GitHub Client (existing)         │       │  ├─ Gmail Sync (existing)             │
│  ├─ Job Queue (Phase 0)              │       │  ├─ Email Matching (existing)         │
│  └─ Claude API (new)                 │       │  ├─ Job Queue (Phase 0)               │
│                                       │       │  └─ Claude API (existing pattern)     │
│  Outputs:                             │       │                                       │
│  └─ codebase_knowledge table         │       │  Outputs:                             │
│                                       │       │  └─ bug_reports table                 │
└───────────────────────────────────────┘       └───────────────────────────────────────┘
                    │                                                   │
                    │                                                   │
                    └─────────────────────────┬─────────────────────────┘
                                              │
                                              ▼
                    ┌──────────────────────────────────────────────────────────────┐
                    │              PHASE 3: EXECUTION ENVIRONMENT                   │
                    │                                                               │
                    │  Dependencies:                                                │
                    │  ├─ Docker Setup (existing)                                  │
                    │  ├─ Job Queue (Phase 0)                                      │
                    │  ├─ GitHub Client (existing) - for cloning                   │
                    │  └─ Token Encryption (existing)                              │
                    │                                                               │
                    │  Outputs:                                                     │
                    │  └─ Sandboxed containers with repo access                    │
                    └──────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                    ┌──────────────────────────────────────────────────────────────┐
                    │              PHASE 4: AGENT ORCHESTRATION                     │
                    │                                                               │
                    │  Dependencies:                                                │
                    │  ├─ Codebase Knowledge (Phase 1)                             │
                    │  ├─ Bug Reports (Phase 2)                                    │
                    │  ├─ Execution Environment (Phase 3)                          │
                    │  └─ Claude API (Opus + Haiku)                                │
                    │                                                               │
                    │  Outputs:                                                     │
                    │  └─ Code changes in sandboxed repo                           │
                    └──────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                    ┌──────────────────────────────────────────────────────────────┐
                    │              PHASE 5: VALIDATION & PR CREATION                │
                    │                                                               │
                    │  Dependencies:                                                │
                    │  ├─ Agent Orchestration (Phase 4)                            │
                    │  ├─ Execution Environment (Phase 3)                          │
                    │  ├─ GitHub Client (existing)                                 │
                    │  └─ PR Suggestions Pattern (existing)                        │
                    │                                                               │
                    │  Outputs:                                                     │
                    │  └─ Pull request on GitHub                                   │
                    └──────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                    ┌──────────────────────────────────────────────────────────────┐
                    │              PHASE 6: MONITORING & SAFETY                     │
                    │                                                               │
                    │  Dependencies:                                                │
                    │  ├─ Activity Logging (existing)                              │
                    │  ├─ All previous phases (for metrics)                        │
                    │  └─ PostHog (existing)                                       │
                    │                                                               │
                    │  Note: Can be built incrementally alongside other phases     │
                    └──────────────────────────────────────────────────────────────┘
```

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT INTAKE LAYER                                 │
│         Email | Chat Widget | Web Form | Slack | API | Client Portal            │
│                                                                                  │
│  EXISTING: Gmail sync, email matching, webhook patterns                         │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          BUG NORMALIZATION ENGINE                                │
│   Parse → Extract Details → Link to Project/Repo → Create BugReport Record      │
│                                                                                  │
│  REUSE: Email matching patterns, client contact lookup                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CODEBASE INTELLIGENCE                                  │
│        Pre-computed knowledge: Architecture | API | Schema | Tests | Style       │
│                                                                                  │
│  REUSE: GitHub client for repo access                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            JOB ORCHESTRATOR                                      │
│      Queue Job → Provision Environment → Clone Repo → Initialize Agent          │
│                                                                                  │
│  NEW: Job queue system (Phase 0)                                                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CLAUDE AGENT SWARM                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    COORDINATOR AGENT (Opus)                              │    │
│  │   Understands bug → Delegates analysis → Synthesizes → Implements fix   │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│         │                    │                    │                    │         │
│         ▼                    ▼                    ▼                    ▼         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │
│  │  Codebase   │    │   Schema    │    │    Test     │    │   Review    │       │
│  │   Agent     │    │   Agent     │    │   Agent     │    │   Agent     │       │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘       │
│                                                                                  │
│  NEW: Claude API integration (currently using Gemini for simpler tasks)         │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       VALIDATION & PR CREATION                                   │
│     Run Tests → Lint → Type Check → Create Branch → Commit → Push → Create PR   │
│                                                                                  │
│  REUSE: GitHub client, PR creation patterns, activity logging                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    HUMAN REVIEW & MERGE (Only Human Step)                        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT NOTIFICATION                                      │
│                   Automatic status updates and resolution notice                 │
│                                                                                  │
│  REUSE: Resend email integration, activity logging                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phased Implementation Plan

### Phase 0: Foundational Infrastructure (NEW)
**Goal:** Establish job queue system for async processing.

**Why this is needed:** The current codebase has no background job processing. All work is synchronous. Autonomous bug fixing requires queued, async job execution.

**Dependencies:**
- PostgreSQL (existing via Supabase)

**Key Deliverables:**
- PostgreSQL-based job queue (pg-boss or custom implementation)
- Job status tracking
- Retry logic with exponential backoff
- Dead letter queue for failed jobs

**Document:** `00a-phase-job-queue.md`

**Estimated Effort:** 1 week

---

### Phase 1: Codebase Intelligence Layer
**Goal:** Pre-analyze linked repositories so Claude has deep understanding before fixing bugs.

**Dependencies:**
- ✅ GitHub OAuth (`lib/oauth/github.ts`)
- ✅ GitHub Client (`lib/github/client.ts`)
- ✅ GitHub Repo Links schema (`githubRepoLinks` table)
- ⬜ Job Queue (Phase 0)
- ⬜ Claude API (Anthropic SDK)

**Key Deliverables:**
- `codebase_knowledge` table
- 5 analysis agents (Architecture, API, Schema, Tests, Conventions)
- Synthesis agent for summary generation
- Webhook handler for incremental updates
- Integration with existing repo linking flow

**Extends:**
- `lib/github/client.ts` - Add file reading capabilities
- `app/api/projects/[projectId]/github-repos/route.ts` - Trigger analysis on link

**Document:** `01-phase-codebase-intelligence.md`

**Estimated Effort:** 2-3 weeks

---

### Phase 2: Bug Intake & Normalization
**Goal:** Unified intake from any source, normalized to standard format.

**Dependencies:**
- ✅ Google OAuth (`lib/oauth/google.ts`)
- ✅ Gmail Sync (`lib/email/sync.ts`)
- ✅ Email Matching (`lib/email/matcher.ts`)
- ✅ Email Links schema (`emailLinks` table)
- ✅ Client Contacts (`clientContacts` table)
- ✅ Webhook Pattern (`app/api/integrations/leads-intake/`)
- ⬜ Job Queue (Phase 0)

**Key Deliverables:**
- `bug_reports` table
- Unified intake API endpoint
- Email adapter (pipes from existing Gmail sync)
- AI-powered bug parsing
- Auto-linking to projects (reuse email matching patterns)

**Extends:**
- `lib/email/sync.ts` - Add bug detection trigger
- `lib/email/matcher.ts` - Reuse for bug→project linking

**Document:** `02-phase-bug-intake.md`

**Estimated Effort:** 1-2 weeks

---

### Phase 3: Execution Environment
**Goal:** Sandboxed, secure environment for cloning repos and running agents.

**Dependencies:**
- ✅ Docker Setup (`Dockerfile`, `docker-compose.yml`)
- ✅ GitHub Client (`lib/github/client.ts`)
- ✅ Token Encryption (`lib/oauth/encryption.ts`)
- ⬜ Job Queue (Phase 0)
- ⬜ Codebase Knowledge (Phase 1) - for context

**Key Deliverables:**
- Worker container image
- Container orchestration (Docker API or Kubernetes)
- Secure secret injection
- Resource limits and isolation
- Cleanup service

**Extends:**
- `Dockerfile` - Add worker variant
- `docker-compose.yml` - Add worker service

**Document:** `03-phase-execution-environment.md`

**Estimated Effort:** 2-3 weeks

---

### Phase 4: Claude Agent Orchestration
**Goal:** Multi-agent system with coordinator and specialists.

**Dependencies:**
- ⬜ Codebase Knowledge (Phase 1)
- ⬜ Bug Reports (Phase 2)
- ⬜ Execution Environment (Phase 3)
- ⬜ Claude API (Anthropic SDK - new dependency)

**Key Deliverables:**
- Coordinator agent (Claude Opus)
- Specialist agents (Claude Haiku): Codebase, Schema, Test, Review
- Tool definitions and implementations
- Agentic loop with error handling
- Token budget management

**New Dependencies to Add:**
- `@anthropic-ai/sdk` - Claude API client
- `simple-git` or `isomorphic-git` - Git operations in Node

**Document:** `04-phase-agent-orchestration.md`

**Estimated Effort:** 3-4 weeks

---

### Phase 5: Validation & PR Creation
**Goal:** Ensure fixes work and create comprehensive PRs.

**Dependencies:**
- ⬜ Agent Orchestration (Phase 4)
- ⬜ Execution Environment (Phase 3)
- ✅ GitHub Client (`lib/github/client.ts`)
- ✅ PR Suggestion Patterns (`lib/data/pr-suggestions/`)
- ✅ Activity Logging (`lib/activity/`)

**Key Deliverables:**
- Validation pipeline (type check → lint → tests → build)
- Git operations in container
- PR creation with detailed context
- PR merge webhook handler

**Extends:**
- `lib/github/client.ts` - Add push capabilities
- `app/api/webhooks/github/route.ts` - Handle PR events

**Document:** `05-phase-validation-pr-creation.md`

**Estimated Effort:** 1-2 weeks

---

### Phase 6: Monitoring, Observability & Safety
**Goal:** Enterprise-grade monitoring, logging, and safety controls.

**Dependencies:**
- ✅ Activity Logging (`lib/activity/`)
- ✅ PostHog (`lib/posthog/`)
- ⬜ All previous phases

**Key Deliverables:**
- Metrics collection and dashboards
- Cost tracking and budgets
- Kill switches
- Alerting (Slack, PagerDuty)
- Audit trail

**Extends:**
- `lib/activity/` - Add autonomous fix event types
- PostHog - Add custom events for fix tracking

**Document:** `06-phase-monitoring-safety.md`

**Note:** Can be built incrementally alongside other phases.

**Estimated Effort:** 2-3 weeks

---

## Critical Gaps Identified (v2.0 Improvements)

### Gap 1: No Job Queue System
**Problem:** Current system is entirely synchronous. Autonomous fixes need async processing.
**Solution:** Added Phase 0 for job queue infrastructure.
**Options:**
- `pg-boss` - PostgreSQL-based, fits existing stack
- `bullmq` + Redis - More mature, requires Redis
- Custom PostgreSQL queue - Simple, no new deps

### Gap 2: AI Model Choice
**Problem:** Current AI uses Gemini via Vercel AI SDK. PRD specifies Claude.
**Solution:** Need to add Anthropic SDK and decide on model strategy.
**Recommendation:**
- Use Claude Opus for Coordinator (complex reasoning)
- Use Claude Haiku for Specialists (fast, cheap)
- Keep Gemini for simpler tasks (email parsing) to reduce costs

### Gap 3: No Git Operations in Node
**Problem:** GitHub client can create PRs but can't clone/commit/push.
**Solution:** Add `simple-git` or `isomorphic-git` dependency.
**Document:** Updated Phase 3 to include git library.

### Gap 4: Missing Vector Search
**Problem:** Codebase intelligence stores knowledge as JSON. Semantic search would improve bug→code matching.
**Solution:** Consider adding vector embeddings for codebase knowledge.
**Options:**
- Supabase Vector (pgvector) - Fits existing stack
- Pinecone - Managed, more features
- Defer to v2.0 - Start without, add later

### Gap 5: Multi-Language Support
**Problem:** Current PRD assumes TypeScript/JavaScript projects.
**Solution:** Phase 1 agents should detect language and adapt.
**Document:** Updated Phase 1 to include language detection.

### Gap 6: Monorepo Handling
**Problem:** No strategy for monorepos with multiple packages.
**Solution:** Add monorepo detection and scoped analysis.
**Document:** Added to Phase 1 edge cases.

### Gap 7: Integration with Existing Task System
**Problem:** Bug reports are separate from tasks. Should they create tasks?
**Solution:** Add optional task creation from bug reports.
**Document:** Updated Phase 2 to include task integration.

### Gap 8: Client Notification Preferences
**Problem:** PRD assumes all clients want email updates.
**Solution:** Add notification preferences to client settings.
**Document:** Updated Phase 2 to include preferences.

### Gap 9: Rate Limiting for External APIs
**Problem:** GitHub and Claude APIs have rate limits.
**Solution:** Add rate limiting awareness to all phases.
**Document:** Added to Phase 6 monitoring.

### Gap 10: Rollback Capability
**Problem:** If a merged fix causes issues, no automated rollback.
**Solution:** Track fix commits, enable revert PRs.
**Document:** Added to Phase 5 post-merge handling.

---

## Revised Timeline with Dependencies

```
Week 1:        Phase 0 (Job Queue)
               ─────────────────────

Week 2-3:      Phase 1 (Codebase Intelligence)
               ───────────────────────────────────
                         │
               Phase 2 (Bug Intake) ← Can run in parallel
               ────────────────────────

Week 4-5:      Phase 3 (Execution Environment)
               ─────────────────────────────────────
                         │
               Phase 6 (Monitoring) ← Start incrementally
               ─────────────────

Week 6-9:      Phase 4 (Agent Orchestration)
               ───────────────────────────────────────────────

Week 10-11:    Phase 5 (Validation & PR)
               ─────────────────────────────

Week 12:       Phase 6 (Complete Monitoring)
               ─────────────────────────────

               Testing & Hardening
               ─────────────────────
```

**Total Revised Effort:** 12-14 weeks (including Phase 0)

---

## Success Metrics

### Primary Metrics
1. **Autonomous Fix Rate:** % of bugs fixed without human intervention (target: >60%)
2. **Time to PR:** Average time from bug report to PR creation (target: <30 minutes)
3. **Fix Quality:** % of PRs approved without changes (target: >80%)
4. **Test Pass Rate:** % of generated fixes that pass existing tests (target: >90%)

### Secondary Metrics
1. **Cost per Fix:** Average API/compute cost per bug fixed (target: <$10)
2. **Token Efficiency:** Tokens used per successful fix (target: <100K)
3. **Escalation Rate:** % of bugs requiring human intervention (target: <40%)
4. **Client Satisfaction:** Rating of automated fix quality (target: >4.0/5.0)

---

## Technical Requirements

### Infrastructure (Existing)
- ✅ **Database:** PostgreSQL via Supabase
- ✅ **Auth:** Supabase Auth + OAuth (Google, GitHub)
- ✅ **Storage:** Supabase Storage
- ✅ **Email:** Resend + Gmail API
- ✅ **Analytics:** PostHog
- ✅ **Containers:** Docker

### Infrastructure (New)
- ⬜ **Job Queue:** pg-boss or custom PostgreSQL queue
- ⬜ **Claude API:** Anthropic SDK
- ⬜ **Git Library:** simple-git or isomorphic-git
- ⬜ **Container Orchestration:** Docker SDK or Kubernetes API
- ⬜ **Alerting:** Slack webhooks, PagerDuty (optional)

### Security Requirements
- ✅ Encrypted credential storage (AES-256-GCM)
- ✅ OAuth token management with refresh
- ⬜ Sandboxed execution environments
- ⬜ Resource limits per container
- ⬜ Audit logging (extend existing)
- ⬜ Rate limiting

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Claude generates incorrect fix | Medium | High | Test validation, human review required |
| Claude introduces security vulnerability | Low | Critical | Security scanning, human review, scope limits |
| Infinite loop / runaway costs | Medium | High | Token budgets, time limits, kill switch |
| Client data exposure | Low | Critical | Sandboxed environments, no prod data access |
| GitHub rate limiting | Medium | Medium | Caching, backoff strategies, multiple tokens |
| Stale codebase knowledge | Medium | Medium | Webhook updates, freshness checks |
| Job queue failure | Low | High | Dead letter queue, monitoring, alerts |
| Container resource exhaustion | Medium | Medium | Resource limits, cleanup service |

---

## Document Index

| Document | Purpose | Status |
|----------|---------|--------|
| `00-PRD-overview.md` | This document | ✅ v2.0 |
| `00a-phase-job-queue.md` | Phase 0: Job Queue | ⬜ To create |
| `01-phase-codebase-intelligence.md` | Phase 1 spec | ✅ Needs update |
| `02-phase-bug-intake.md` | Phase 2 spec | ✅ Needs update |
| `03-phase-execution-environment.md` | Phase 3 spec | ✅ Needs update |
| `04-phase-agent-orchestration.md` | Phase 4 spec | ✅ Needs update |
| `05-phase-validation-pr-creation.md` | Phase 5 spec | ✅ Needs update |
| `06-phase-monitoring-safety.md` | Phase 6 spec | ✅ Needs update |
| `07-edge-cases-failure-modes.md` | Failure analysis | ✅ Complete |

---

## Changelog

### v2.0 (December 24, 2024)
- Added "Existing Infrastructure" section documenting what can be reused
- Added Phase 0 (Job Queue) as foundational requirement
- Created visual dependency graph between phases
- Identified 10 critical gaps with solutions
- Updated timeline with dependencies
- Added specific npm packages needed
- Marked existing vs new infrastructure
- Added cost targets to success metrics

### v1.0 (December 24, 2024)
- Initial PRD creation

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Tech Lead | | | |
| Security | | | |
