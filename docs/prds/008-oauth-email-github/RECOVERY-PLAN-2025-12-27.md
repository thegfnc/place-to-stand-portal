# Recovery Plan: Schema & UI Consolidation

**Created:** December 27, 2025
**Status:** RECOVERING FROM CRASHED SESSION
**Branch:** `feature/email-and-github-integration`

---

## Context

A previous Claude session created a plan to consolidate the email/suggestions architecture but crashed 20 minutes into implementation without saving the plan. This document reconstructs the plan from:
1. Partial notes shared with coworker
2. Analysis of uncommitted git changes

---

## Part 1: Database Design Issues (from notes)

### Issue 1: Duplicate Suggestion Systems

**Current state:** Two separate tables with overlapping purposes:
- `task_suggestions` - AI suggestions for creating tasks from emails
- `pr_suggestions` - AI suggestions for creating PRs from emails/tasks

**Problem:** Different status enums (`suggestionStatus` vs `prSuggestionStatus`), duplicated patterns, and no unified way to handle future suggestion types (e.g., Slack messages → tasks, GitHub issues → tasks).

**Recommendation:** Create a unified `ai_suggestions` table:
```
ai_suggestions
├── id, type (TASK | PR | COMMENT | etc.)
├── source_type (EMAIL | GITHUB_ISSUE | SLACK | etc.)
├── source_id (polymorphic reference)
├── target_project_id (optional)
├── suggested_content (JSONB - flexible for different types)
├── confidence, reasoning, status
├── reviewed_by, reviewed_at, created_artifact_id
```

### Issue 2: Gmail-Specific Email Schema

**Current state:** `emailMetadata` table has Gmail-specific fields (`gmailMessageId`)

**Problem:** Can't support other email providers (Outlook, IMAP) in the future.

**Recommendation:** Rename to `messages` with provider-agnostic structure:
```
messages
├── id, user_id
├── provider (GMAIL | OUTLOOK | IMAP)
├── provider_message_id (the gmailMessageId)
├── provider_thread_id (optional)
├── ... rest of fields
```

### Issue 3: No Polymorphic Link Table

**Current state:** `emailLinks` links emails to clients/projects separately. Future sources would need new link tables.

**Recommendation:** Consider a generalized `entity_links` pattern or keep separate but document the pattern.

### Issue 4: Redundant Enums

**Current state:**
- `suggestionStatus`: PENDING, APPROVED, REJECTED, MODIFIED, EXPIRED
- `prSuggestionStatus`: DRAFT, PENDING, APPROVED, REJECTED, FAILED

**Recommendation:** Unify into single `suggestionStatus` enum that covers all cases:
```
DRAFT, PENDING, APPROVED, REJECTED, FAILED, MODIFIED, EXPIRED
```

---

## Part 2: UI Design Issues (from notes)

### Issue 1: Fragmented Navigation

**Current state:** Three separate top-level pages:
- `/emails` - View synced emails
- `/suggestions` - Task suggestions from emails
- `/pr-suggestions` - PR suggestions (not even in nav!)

**Problem:** Users need to jump between 3+ pages to complete a simple workflow (email → suggestion → task).

**Recommendation:** Create unified "Inbox" or "AI Inbox" page:
```
/inbox (or /ai-inbox)
├── Tab: All | Emails | Task Suggestions | PR Suggestions
├── Unified list with type indicators
├── Single review flow for all suggestion types
```

### Issue 2: Suggestions Also in Projects Board

**Current state:** AI suggestions sheet exists in `projects/_components/ai-suggestions/` for project-scoped viewing.

**Problem:** Two places to review same suggestions = confusion about which is authoritative.

**Recommendation:** Keep project-scoped view but make it clearly a "filtered view" of the main inbox, not a separate system.

### Issue 3: Email Page is Disconnected

**Current state:** `/emails` shows all emails but isn't integrated into client/project workflows.

**Better pattern:** Show emails contextually:
- On client detail page: Show emails linked to that client
- On project page: Show emails linked to that project
- Standalone `/emails` becomes a global search/browse

### Issue 4: Missing Navigation for PR Suggestions

**Current state:** `/pr-suggestions` page exists but isn't in the navigation config.

**Immediate fix:** Either add to nav or consolidate into unified inbox.

---

## Part 3: Implementation State (reconstructed from git diff)

### What Was Changed - DETAILED ANALYSIS

**New Migration:** `0007_unified_messaging.sql` - COMPLETE
Consolidates 5 previous migrations into one comprehensive migration:
- Creates unified enums: `oauth_provider`, `oauth_connection_status`, `message_source`, `thread_status`, `suggestion_type`, `suggestion_status`
- All RLS policies and indexes included

**New Tables Created (all fully defined):**

| Table | Purpose | Status |
|-------|---------|--------|
| `oauth_connections` | Multi-account OAuth (Google, GitHub) | Complete |
| `client_contacts` | Email addresses linked to clients | Complete |
| `threads` | Conversation containers | Complete |
| `messages` | Provider-agnostic message storage | Complete |
| `message_attachments` | Attachments for messages | Complete |
| `email_raw` | RFC822 storage for compliance | Complete |
| `github_repo_links` | Project-to-repo associations | Complete |
| `suggestions` | Unified polymorphic suggestions (TASK, PR, REPLY) | Complete |
| `suggestion_feedback` | User corrections for AI improvement | Complete |

**New Query Files - STATUS:**

| File | Functions | Status |
|------|-----------|--------|
| `lib/queries/messages.ts` | getMessageById, createMessage, listMessagesForThread, getUnanalyzedMessagesForClient, etc. | **COMPLETE** |
| `lib/queries/threads.ts` | (need to check) | Unknown |
| `lib/queries/suggestions.ts` | getSuggestionById, getSuggestionWithContext, createSuggestion, updateSuggestionStatus, listPendingSuggestions, getSuggestionsForProject | **COMPLETE** |

**New Type Files:**
| File | Types | Status |
|------|-------|--------|
| `lib/types/messages.ts` | Message, MessageSource, MessageWithAttachments, etc. | Created |
| `lib/types/suggestions.ts` | Suggestion, SuggestionType, SuggestionStatus, TaskSuggestedContent, PRSuggestedContent | Modified |

**Deleted Files:**
- `lib/queries/emails.ts` - Replaced by `messages.ts`
- `lib/queries/ai-suggestions.ts` - Replaced by `suggestions.ts`
- `lib/data/pr-suggestions/index.ts` - Merged into `lib/data/suggestions/index.ts`
- `lib/types/emails.ts` - Replaced by `lib/types/messages.ts`
- UI components (emails-panel, suggestions-panel, pr-suggestions-panel, etc.)
- Dev/test scripts (batch-match-emails.ts, setup-test-data.ts, etc.)

### Current TypeScript Errors (17 total)

The refactoring is ~80% complete. These files still reference old patterns:

| File | Issue | Fix Required |
|------|-------|--------------|
| `app/(dashboard)/pr-suggestions/page.tsx` | References deleted `@/lib/data/pr-suggestions` | Delete page or update imports |
| `app/(dashboard)/suggestions/page.tsx` | References deleted `_components/suggestions-panel` | Delete page or create new component |
| `app/(dashboard)/projects/_components/ai-suggestions/pr-preview-dialog.tsx` | Uses old property names (`suggestedTitle` etc.) | Update to use `suggestedContent.title` |
| `app/api/dev/seed/route.ts` | References deleted `emailMetadata` export | Update to use new `messages` schema |
| `.next/dev/types/validator.ts` | Stale build artifact referencing deleted page | Run `rm -rf .next` |

---

## Part 4: Recovery Options

### Option A: Continue the Refactor
1. Review new schema/migration file
2. Complete the query layer updates
3. Fix all TypeScript errors
4. Update remaining UI consumers
5. Test thoroughly

### Option B: Rollback and Restart Fresh
1. `git checkout -- .` to discard all changes
2. Re-plan the consolidation with this document as reference
3. Implement incrementally with commits at each stage

### Option C: Partial Rollback
1. Keep schema changes but restore UI temporarily
2. Fix TypeScript errors minimally to get build working
3. Continue refactoring UI in smaller commits

---

## Next Steps

**TODO:** Review the current state of:
1. `lib/db/schema.ts` - What schema changes were made?
2. `drizzle/migrations/0007_unified_messaging.sql` - Full migration SQL
3. New query files - Are they complete?
4. Decide on recovery option

---

## Part 5: Recovery Actions Taken (December 27, 2025)

### Fixes Applied

1. **Deleted `/pr-suggestions` page** - Was a standalone page that should be consolidated into unified inbox per plan
2. **Updated `/suggestions` page** - Replaced with simple summary page that uses new `getPendingSuggestionCounts()` query
3. **Fixed `pr-preview-dialog.tsx`** - Updated property references:
   - `suggestedTitle` → `suggestedContent.title`
   - `suggestedBody` → `suggestedContent.body`
   - `suggestedBranch` → `suggestedContent.branch`
   - `suggestedBaseBranch` → `suggestedContent.baseBranch`
   - `repoLink` → `githubRepoLink`
4. **Rewrote `dev/seed` route** - Updated to use new `threads` and `messages` tables instead of old `emailMetadata`
5. **Restored `/emails` page** - Was redirecting to non-existent `/inbox`. Created new EmailsPanel component using `listThreadsForUser()` and `getMessageCountsForUser()` queries

### Verification

- `npm run type-check` - **PASSED** (0 errors)
- `npm run lint` - **PASSED** (0 errors, 19 warnings - unused imports in query files)

### Current State

The codebase is now in a **working state** with the new unified schema. The migration `0007_unified_messaging.sql` is ready to apply.

**Next steps to complete Phase 5:**
1. Apply the migration to staging/production: `npm run db:migrate`
2. Update remaining UI components to use the new data layer
3. Build the unified inbox page (per UI plan)
4. Update email sync service to use new `threads`/`messages` tables

---

## Lesson Learned

**ALWAYS save plans to a file before starting implementation.** Use this file as the source of truth and update it as work progresses.
