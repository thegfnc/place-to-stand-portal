# Edge Cases & Failure Modes

**Status:** Planning
**Purpose:** Comprehensive analysis of what can go wrong and how to handle it

---

## Overview

An autonomous bug-fixing system has many failure points. This document catalogs edge cases, failure modes, and the system's response to each. The goal is to ensure the system fails gracefully, escalates appropriately, and never causes more damage than the original bug.

---

## Failure Classification

| Severity | Definition | Response |
|----------|------------|----------|
| **Critical** | Data loss, security breach, production outage | Immediate halt, human intervention required |
| **High** | Job failure, incorrect fix, test failures | Retry with escalation path |
| **Medium** | Delays, suboptimal fixes, partial failures | Log and continue with monitoring |
| **Low** | Minor issues, edge cases handled | Auto-recover, log for improvement |

---

## Phase 1: Codebase Intelligence Failures

### F1.1: Repository Clone Fails

**Cause:** Network issues, authentication failure, repo deleted

**Detection:**
- Git clone command exits with non-zero status
- Timeout after 5 minutes

**Response:**
1. Retry up to 3 times with exponential backoff
2. If persistent, check OAuth token validity
3. If token invalid, mark OAuth connection as `EXPIRED`
4. Alert team, mark knowledge status as `FAILED`

**Mitigation:**
- Pre-validate OAuth tokens before starting
- Use shallow clone for faster initial fetch
- Cache clones where possible

---

### F1.2: Analysis Agent Produces Invalid Output

**Cause:** Agent hallucination, malformed JSON, missing fields

**Detection:**
- Zod schema validation fails
- Required fields are null/undefined
- Values are clearly wrong (e.g., negative file count)

**Response:**
1. Retry agent with more explicit instructions
2. If still fails, run with different model (Sonnet instead of Haiku)
3. If still fails, mark knowledge as `PARTIAL` with available data
4. Alert team for manual review

**Mitigation:**
- Use structured output mode with strict schemas
- Validate output against known facts (e.g., package.json exists)
- Cross-validate between agents (architecture should match API routes)

---

### F1.3: Repository Too Large

**Cause:** Monorepo, many binary files, deep history

**Detection:**
- Clone exceeds timeout
- Disk space limit hit
- Token usage exceeds budget during analysis

**Response:**
1. Use shallow clone with depth=1
2. Exclude large/binary directories from analysis
3. Analyze subset of most relevant directories
4. Document limitations in knowledge record

**Mitigation:**
- Allow configuration of analysis scope per repo
- Support .autonomousfixignore file in repos
- Detect monorepo patterns and adjust strategy

---

### F1.4: Codebase Knowledge Becomes Stale

**Cause:** Many commits since last analysis, major refactoring

**Detection:**
- Webhook shows significant file changes
- Agent references non-existent files
- Fix attempts fail with "file not found"

**Response:**
1. Mark knowledge as `STALE`
2. Queue full re-analysis before next fix
3. For urgent bugs, proceed with warning
4. Record staleness-related failures

**Mitigation:**
- Webhook-triggered incremental updates
- Periodic full refresh (weekly)
- Staleness check before each fix job

---

## Phase 2: Bug Intake Failures

### F2.1: Bug Report Parsing Fails

**Cause:** Unclear description, non-English, image-only report

**Detection:**
- AI extraction returns low confidence (<0.3)
- Missing critical fields (no description at all)
- Language detection indicates non-English

**Response:**
1. Mark bug as `NEEDS_INFO`
2. Send templated response asking for clarification
3. If pattern repeats from same client, flag for human review
4. Store raw input for later processing

**Mitigation:**
- Provide structured intake forms where possible
- Support multi-language with translation
- Accept screenshots with OCR
- Train on failed parsing cases

---

### F2.2: Cannot Link Bug to Project

**Cause:** Unknown sender, ambiguous match, new client

**Detection:**
- Linking confidence <0.5
- Multiple projects match with similar confidence
- Sender email domain not in any client

**Response:**
1. Mark bug as `NEEDS_HUMAN`
2. Present options to admin for manual linking
3. Create suggestion for new client/contact if appropriate
4. Learn from manual resolution

**Mitigation:**
- Require client registration before bug submission
- Support explicit project tagging in intake
- Build sender→client mapping over time

---

### F2.3: Duplicate Bug Detected

**Cause:** Client reports same issue multiple times

**Detection:**
- Semantic similarity >0.9 with recent bug
- Same error message/stack trace
- Same reporter within short time window

**Response:**
1. Mark as `DUPLICATE` with link to original
2. Add message content as additional context to original
3. Notify reporter of existing bug and its status
4. Don't create new fix job

**Mitigation:**
- Check duplicates before acknowledging receipt
- Show existing bug status to reporter immediately
- Merge related reports into single thread

---

### F2.4: Malicious Bug Report

**Cause:** Injection attempt, spam, abuse

**Detection:**
- Content contains suspicious patterns (SQL injection, script tags)
- High volume from single source
- Known spam patterns

**Response:**
1. Don't process bug
2. Log security event
3. Block source if pattern repeats
4. Alert security team if serious attempt

**Mitigation:**
- Input sanitization
- Rate limiting per source
- Honeypot fields in forms
- Block known bad actors

---

## Phase 3: Execution Environment Failures

### F3.1: Container Fails to Provision

**Cause:** Docker daemon down, resource exhaustion, image pull failure

**Detection:**
- Container creation API returns error
- Timeout waiting for container to start
- Health check fails

**Response:**
1. Retry on different worker node
2. If cluster-wide issue, activate kill switch
3. Queue jobs for later processing
4. Alert infrastructure team

**Mitigation:**
- Multiple worker nodes in different zones
- Pre-pulled images
- Resource monitoring and auto-scaling
- Container health checks

---

### F3.2: Container Runs Out of Resources

**Cause:** Large test suite, memory leak, infinite loop

**Detection:**
- OOM killer terminates process
- CPU throttling for extended period
- Disk quota exceeded

**Response:**
1. Kill container
2. Mark job as `FAILED` with resource cause
3. Consider if job needs larger allocation
4. Alert if pattern repeats

**Mitigation:**
- Strict resource limits
- Progressive timeouts (warn before kill)
- Monitor resource usage trends
- Adjust limits per repository complexity

---

### F3.3: Network Partition During Job

**Cause:** Cloud provider issues, DNS failure

**Detection:**
- GitHub API calls timeout
- Cannot push branch
- Claude API unreachable

**Response:**
1. Retry with backoff
2. If persistent, pause job and wait
3. Resume from last checkpoint when network returns
4. Timeout job if network down >10 minutes

**Mitigation:**
- Implement checkpointing for long jobs
- Cache API responses where safe
- Multi-region deployment
- Circuit breaker pattern

---

### F3.4: Secrets Leaked in Logs

**Cause:** Verbose logging, error messages contain secrets

**Detection:**
- Pattern matching in log output
- Known secret patterns (API keys, tokens)

**Response:**
1. Immediately scrub logs
2. Rotate affected credentials
3. Alert security team
4. Review logging configuration

**Mitigation:**
- Secret redaction in all log outputs
- Structured logging with safe fields
- Environment variable sanitization
- Regular log audits

---

## Phase 4: Agent Failures

### F4.1: Agent Stuck in Loop

**Cause:** Circular reasoning, repeated tool calls, no progress

**Detection:**
- Same tool called with same inputs 3+ times
- Iteration count exceeds limit
- No new information gained

**Response:**
1. Force exit current approach
2. Inject "try a different approach" prompt
3. If still stuck, escalate to human
4. Log pattern for prompt improvement

**Mitigation:**
- Track tool call patterns
- Detect cycles in reasoning
- Maximum iteration limits
- Intervention prompts at milestones

---

### F4.2: Agent Makes Wrong Fix

**Cause:** Misunderstands bug, fixes symptom not cause, incomplete context

**Detection:**
- Tests fail after fix
- Fix doesn't address bug (validated by review agent)
- Client reports bug persists after merge

**Response:**
1. If tests fail: give agent failure details, retry
2. If review fails: request reconsideration
3. If merged and fails: create follow-up bug, alert team
4. Track wrong-fix rate per bug type

**Mitigation:**
- Require test validation
- Multiple specialist agents cross-check
- Review agent before commit
- Post-merge monitoring

---

### F4.3: Agent Introduces Security Vulnerability

**Cause:** Insecure patterns, input validation removed, SQL injection

**Detection:**
- Security scanning tools flag issue
- Review agent detects common vulnerabilities
- SAST/DAST in CI pipeline catches it

**Response:**
1. Block PR from merge
2. Flag for human security review
3. Track vulnerability types introduced
4. Add to agent training/prompting

**Mitigation:**
- Security scanning in validation pipeline
- Explicit security instructions in prompts
- Forbidden pattern detection
- Security-focused review agent

---

### F4.4: Agent Token Budget Exhausted

**Cause:** Complex bug, verbose output, many tool calls

**Detection:**
- Token count exceeds budget
- API returns token limit error

**Response:**
1. Graceful exit with partial progress saved
2. Attempt to summarize and continue with Haiku
3. If still over, escalate to human with context
4. Track patterns of high-token bugs

**Mitigation:**
- Token budgets with warnings before limit
- Progressive summarization
- Efficient prompts
- Model tiering (Haiku for simple tasks)

---

### F4.5: Agent Hallucinates Non-Existent Code

**Cause:** Similar names in training data, outdated codebase knowledge

**Detection:**
- File reads return "not found"
- References to undefined functions
- Import errors in validation

**Response:**
1. Inform agent of hallucination
2. Request it verify paths before use
3. If persistent, refresh codebase knowledge
4. Log hallucination patterns

**Mitigation:**
- Validate paths before operations
- Fresh codebase analysis
- Ground agent in actual file listings
- Hallucination detection in outputs

---

## Phase 5: Validation & PR Failures

### F5.1: Tests Pass But Fix Is Wrong

**Cause:** Insufficient test coverage, mocked dependencies, wrong assertions

**Detection:**
- Client reports bug persists
- Manual review catches issue
- Different behavior in production

**Response:**
1. Create follow-up bug
2. Flag original bug for re-fix
3. Add missing test coverage
4. Track coverage-related failures

**Mitigation:**
- Coverage requirements for affected code
- Integration tests not just unit tests
- Review agent verifies test validity
- Post-deploy smoke tests

---

### F5.2: Build Fails

**Cause:** Type errors, import issues, missing dependencies

**Detection:**
- Build command exits non-zero
- Compiler errors in output

**Response:**
1. Parse errors and give to agent
2. Allow agent to fix build errors
3. If can't fix after 2 attempts, escalate
4. Track common build failure patterns

**Mitigation:**
- Type checking before build
- Incremental builds to catch issues early
- Dependency resolution verification

---

### F5.3: PR Creation Fails

**Cause:** Rate limit, permission issue, branch conflict

**Detection:**
- GitHub API returns error
- 403/401 status codes
- Conflict errors

**Response:**
1. For rate limit: wait and retry
2. For permission: check OAuth scopes, refresh token
3. For conflict: rebase and retry
4. If persistent, escalate

**Mitigation:**
- Pre-validate permissions
- Rate limit tracking
- Rebase before push
- Token rotation

---

### F5.4: PR Approved But Merge Fails

**Cause:** Branch protection rules, CI failures, conflicts developed

**Detection:**
- Merge API returns conflict
- Branch protection violation
- CI status checks failed

**Response:**
1. For conflicts: rebase and update PR
2. For CI: investigate and fix
3. For protection: alert human reviewer
4. Track merge failure patterns

**Mitigation:**
- Keep PRs up to date with base
- Monitor CI status
- Document branch protection requirements

---

## Phase 6: Monitoring & Safety Failures

### F6.1: Budget Exceeded

**Cause:** Many expensive jobs, cost estimation error, price change

**Detection:**
- Cost tracking crosses threshold
- Budget alert triggered

**Response:**
1. Alert at warning threshold
2. Notify team at critical threshold
3. Activate kill switch at hard limit
4. Review and adjust budget or limits

**Mitigation:**
- Conservative budget estimates
- Real-time cost tracking
- Automatic scaling down when approaching limit
- Cost anomaly detection

---

### F6.2: Kill Switch Fails to Activate

**Cause:** Database unreachable, worker doesn't check flag

**Detection:**
- Jobs continue after kill switch set
- Manual verification shows jobs running

**Response:**
1. Direct container kill via orchestrator
2. Network-level blocking
3. Revoke API tokens
4. Post-incident review

**Mitigation:**
- Multiple kill switch mechanisms
- Heartbeat-based checks
- Dead man's switch (require periodic confirmation to continue)

---

### F6.3: Alerting System Fails

**Cause:** Alert service down, config error, alert fatigue

**Detection:**
- Known issues not alerted
- Monitoring dashboard shows problems
- Manual observation

**Response:**
1. Backup alerting channel (SMS if email fails)
2. Escalation path if primary responder doesn't acknowledge
3. Regular alert testing

**Mitigation:**
- Multiple alerting channels
- Alert redundancy
- Regular alert testing
- On-call rotation

---

### F6.4: Audit Log Gaps

**Cause:** Logging failure, disk full, async queue backup

**Detection:**
- Missing events in audit trail
- Gaps in timestamp sequence
- Compliance audit fails

**Response:**
1. Alert on log gaps
2. Reconstruct from other sources if possible
3. Document gap in audit record
4. Fix logging issue

**Mitigation:**
- Synchronous critical logs
- Log to multiple destinations
- Storage monitoring
- Log integrity verification

---

## Cross-Cutting Concerns

### C1: Cascading Failures

**Scenario:** One failure causes system-wide collapse

**Example:** Agent creates file with infinite loop, build hangs, all workers blocked

**Response:**
1. Timeouts at every level
2. Resource isolation between jobs
3. Circuit breakers for shared resources
4. Auto-recovery with clean slate

---

### C2: Partial Failures

**Scenario:** Job partially complete when failure occurs

**Example:** Files written but not committed, commit created but not pushed

**Response:**
1. Checkpoint tracking
2. Rollback capability
3. Idempotent operations where possible
4. Clear cleanup on failure

---

### C3: Race Conditions

**Scenario:** Multiple jobs affect same repository

**Example:** Two bugs for same project queued, both try to create branches

**Response:**
1. Lock repository during job
2. Queue jobs per repository
3. Detect and merge related bugs
4. Conflict detection and resolution

---

### C4: External Service Outages

**Scenario:** GitHub, Claude API, or other dependency is down

**Detection:**
- Health checks fail
- API calls timeout/error
- Status page shows issues

**Response:**
1. Queue jobs for later
2. Notify users of delay
3. Process with degraded functionality if possible
4. Automatic resume when service returns

---

## Recovery Procedures

### R1: Full System Recovery

1. Activate global kill switch
2. Verify all containers stopped
3. Clear job queue or mark queued as `CANCELLED`
4. Investigate and fix root cause
5. Deactivate kill switch
6. Process backlog gradually

---

### R2: Single Job Recovery

1. Cancel job
2. Cleanup container if running
3. Reset bug report status to `READY`
4. Clear any partial changes (branches, commits)
5. Re-queue with fresh state

---

### R3: Data Recovery

1. Restore from backup if needed
2. Reconcile state from audit logs
3. Verify data integrity
4. Resume operations

---

### R4: Credential Rotation

1. Generate new tokens/keys
2. Update in secure storage
3. Invalidate old credentials
4. Verify new credentials work
5. Monitor for unauthorized access

---

## Escalation Matrix

| Situation | Level 1 (Auto) | Level 2 (Alert) | Level 3 (Wake Up) |
|-----------|----------------|-----------------|-------------------|
| Single job fails | Retry | After 3 retries | Never |
| Multiple jobs fail | Throttle | After 5 in 1 hour | After 20 in 1 hour |
| Budget warning | Log | 80% threshold | 95% threshold |
| Budget exceeded | Block new jobs | Immediate | N/A |
| Security issue | Block & log | Immediate | Immediate |
| Kill switch activated | N/A | Immediate | If auto-triggered |
| System down | Auto-restart | After 5 min | After 15 min |

---

## Post-Incident Review Template

For any significant failure:

1. **Summary:** What happened?
2. **Timeline:** When did it start, when detected, when resolved?
3. **Impact:** How many jobs affected? Any data loss? Client impact?
4. **Root Cause:** Why did it happen?
5. **Detection:** How was it detected? Could we detect faster?
6. **Response:** What actions were taken? Were they effective?
7. **Prevention:** How do we prevent recurrence?
8. **Action Items:** Specific tasks with owners and deadlines

---

## Continuous Improvement

### Learning from Failures

1. Track all failure types and frequencies
2. Identify patterns and trends
3. Prioritize fixes by impact and frequency
4. A/B test improvements
5. Measure improvement over time

### Failure Injection Testing

1. Regular chaos engineering exercises
2. Test each failure mode intentionally
3. Verify detection and response work
4. Train team on procedures
5. Update documentation based on learnings

---

## Summary Checklist

Before launch, verify:

- [ ] Every failure mode has detection logic
- [ ] Every failure mode has response logic
- [ ] Timeouts at every external call
- [ ] Resource limits on every container
- [ ] Kill switch tested and working
- [ ] Alerting tested end-to-end
- [ ] Audit logging comprehensive
- [ ] Recovery procedures documented
- [ ] Team trained on escalation
- [ ] Chaos testing completed
