# Place to Stand Portal: Google Cloud & GitHub Integration

## Master Plan Index

This project is divided into **5 phases** with **29 individual tasks**. Each task is documented in its own file and sized for a junior engineer to complete.

### Dependency Graph

```
Phase 1: Google OAuth + Gmail
├── 1.1-token-encryption.md (no deps)
├── 1.2-oauth-schema.md (depends: 1.1)
├── 1.3-google-oauth-flow.md (depends: 1.2)
├── 1.4-gmail-client.md (depends: 1.3)
├── 1.5-integrations-ui.md (depends: 1.3)

Phase 2: Email Linking System
├── 2.1-client-contacts-schema.md (depends: 1.2)
├── 2.2-client-contacts-ui.md (depends: 2.1)
├── 2.3-email-metadata-schema.md (depends: 1.2)
├── 2.4-email-sync-service.md (depends: 1.4, 2.3)
├── 2.5-email-matcher.md (depends: 2.1, 2.3)
├── 2.6-email-linking-ui.md (depends: 2.4, 2.5)

Phase 3: AI Task Suggestions
├── 3.1-task-suggestions-schema.md (depends: 2.3)
├── 3.2-email-analysis-ai.md (depends: 3.1)
├── 3.3-suggestions-api.md (depends: 3.2)
├── 3.4-suggestions-review-ui.md (depends: 3.3)

Phase 4: GitHub Integration
├── 4.1-github-oauth.md (depends: 1.2)
├── 4.2-github-repo-schema.md (depends: 4.1)
├── 4.3-repo-linking-ui.md (depends: 4.2)
├── 4.4-pr-suggestions-ai.md (depends: 3.2, 4.2)
├── 4.5-pr-suggestions-ui.md (depends: 4.4)
 
Phase 5: Threads & Unified Ingestion
├── 5.1-threads-and-messages-schema.md (depends: 2.1, 2.3)
├── 5.2-message-ingestion-api.md (depends: 5.1)
├── 5.3-email-processing-workers.md (depends: 1.4, 2.3, 5.1)
├── 5.4-threads-ui.md (depends: 5.1, 5.2)
├── 5.5-leads-to-client-conversion.md (depends: PRD 007)
├── 5.6-identity-linking-and-compose.md (depends: 1.3, 2.1)
 ├── 5.7-attachments-and-storage-policy.md (depends: 5.1)
 ├── 5.8-search-and-indexing.md (depends: 5.1)
 ├── 5.9-privacy-and-retention.md (depends: 5.1, 5.7)
```

### Parallelization Opportunities

**Can run in parallel:**
- 1.1 (encryption) - standalone foundation
- 2.1 (client contacts schema) + 2.3 (email metadata schema) - after 1.2
- 1.4 (gmail client) + 1.5 (integrations ui) - after 1.3
- 2.2 (contacts ui) + 2.4 (sync) + 2.5 (matcher) - with respective deps
- 4.1 (github oauth) - can start after 1.2, parallel to Phase 2/3

### Task Files Location

All task files are in: `docs/plans/tasks/`

### Quick Reference

| Task | File | Est. Complexity | Dependencies |
|------|------|-----------------|--------------|
| 1.1 | `1.1-token-encryption.md` | Low | None |
| 1.2 | `1.2-oauth-schema.md` | Medium | 1.1 |
| 1.3 | `1.3-google-oauth-flow.md` | High | 1.2 |
| 1.4 | `1.4-gmail-client.md` | Medium | 1.3 |
| 1.5 | `1.5-integrations-ui.md` | Medium | 1.3 |
| 2.1 | `2.1-client-contacts-schema.md` | Low | 1.2 |
| 2.2 | `2.2-client-contacts-ui.md` | Medium | 2.1 |
| 2.3 | `2.3-email-metadata-schema.md` | Medium | 1.2 |
| 2.4 | `2.4-email-sync-service.md` | High | 1.4, 2.3 |
| 2.5 | `2.5-email-matcher.md` | Medium | 2.1, 2.3 |
| 2.6 | `2.6-email-linking-ui.md` | High | 2.4, 2.5 |
| 3.1 | `3.1-task-suggestions-schema.md` | Medium | 2.3 |
| 3.2 | `3.2-email-analysis-ai.md` | High | 3.1 |
| 3.3 | `3.3-suggestions-api.md` | Medium | 3.2 |
| 3.4 | `3.4-suggestions-review-ui.md` | High | 3.3 |
| 4.1 | `4.1-github-oauth.md` | Medium | 1.2 |
| 4.2 | `4.2-github-repo-schema.md` | Low | 4.1 |
| 4.3 | `4.3-repo-linking-ui.md` | Medium | 4.2 |
| 4.4 | `4.4-pr-suggestions-ai.md` | High | 3.2, 4.2 |
| 4.5 | `4.5-pr-suggestions-ui.md` | Medium | 4.4 |
| 5.1 | `5.1-threads-and-messages-schema.md` | High | 2.1, 2.3 |
| 5.2 | `5.2-message-ingestion-api.md` | High | 5.1 |
| 5.3 | `5.3-email-processing-workers.md` | High | 1.4, 2.3, 5.1 |
| 5.4 | `5.4-threads-ui.md` | Medium | 5.1, 5.2 |
| 5.5 | `5.5-leads-to-client-conversion.md` | Medium | PRD 007 |
| 5.6 | `5.6-identity-linking-and-compose.md` | Medium | 1.3, 2.1 |
| 5.7 | `5.7-attachments-and-storage-policy.md` | Low | 5.1 |
| 5.8 | `5.8-search-and-indexing.md` | Low | 5.1 |
| 5.9 | `5.9-privacy-and-retention.md` | Medium | 5.1, 5.7 |
