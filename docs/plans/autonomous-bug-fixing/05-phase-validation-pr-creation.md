# Phase 5: Validation & PR Creation

**Status:** Planning
**Priority:** High
**Estimated Effort:** 1-2 weeks
**Dependencies:** Phase 4 (Agent Orchestration)

---

## Overview

Before creating a pull request, the system must validate that the fix actually works and doesn't break existing functionality. This phase implements comprehensive validation (tests, linting, type checking) and creates well-documented pull requests that are easy for humans to review and merge.

---

## Goals

1. **Validation confidence** - Ensure fixes don't introduce regressions
2. **Quality gates** - Block bad fixes before they become PRs
3. **Clear documentation** - PRs explain the bug, root cause, and fix
4. **Easy review** - Minimize human effort to review and merge
5. **Traceability** - Link PRs back to bug reports and fix jobs

---

## Validation Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FIX IMPLEMENTATION COMPLETE                            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              VALIDATION GATE 1                                   │
│                               Type Checking                                      │
│                                                                                  │
│  Command: npm run type-check (or tsc --noEmit)                                  │
│  Failure: Block PR, return to agent for fix                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              VALIDATION GATE 2                                   │
│                                 Linting                                          │
│                                                                                  │
│  Command: npm run lint                                                           │
│  Failure: Auto-fix if possible, otherwise return to agent                       │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              VALIDATION GATE 3                                   │
│                               Test Suite                                         │
│                                                                                  │
│  Command: npm run test                                                           │
│  Failure: Return to agent with failure details                                  │
│  Retry: Agent attempts to fix test failures (max 2 attempts)                    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              VALIDATION GATE 4                                   │
│                              Build Check                                         │
│                                                                                  │
│  Command: npm run build                                                          │
│  Failure: Return to agent for fix                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ALL VALIDATIONS PASSED                                 │
│                             Ready for PR Creation                                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Validation Implementation

### Validation Runner

```typescript
// lib/validation/runner.ts

export interface ValidationResult {
  passed: boolean
  gate: 'type-check' | 'lint' | 'test' | 'build'
  output: string
  duration: number
  details?: {
    errors?: ValidationError[]
    warnings?: ValidationWarning[]
    coverage?: CoverageReport
  }
}

export interface ValidationError {
  file: string
  line: number
  column: number
  message: string
  rule?: string
  severity: 'error' | 'warning'
}

export async function runValidationPipeline(
  executor: ToolExecutor,
  knownCommands: CodebaseKnowledge['architecture']['commands']
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = []

  // Gate 1: Type Checking
  const typeCheckResult = await runTypeCheck(executor, knownCommands.typeCheck)
  results.push(typeCheckResult)

  if (!typeCheckResult.passed) {
    return results // Stop pipeline on failure
  }

  // Gate 2: Linting
  const lintResult = await runLint(executor, knownCommands.lint)
  results.push(lintResult)

  if (!lintResult.passed) {
    // Try auto-fix
    const autoFixResult = await runLintAutoFix(executor)
    if (!autoFixResult.passed) {
      return results
    }
    // Re-run lint to verify
    const relintResult = await runLint(executor, knownCommands.lint)
    results.push(relintResult)
    if (!relintResult.passed) {
      return results
    }
  }

  // Gate 3: Tests
  const testResult = await runTests(executor, knownCommands.test)
  results.push(testResult)

  if (!testResult.passed) {
    return results
  }

  // Gate 4: Build
  const buildResult = await runBuild(executor, knownCommands.build)
  results.push(buildResult)

  return results
}

async function runTypeCheck(
  executor: ToolExecutor,
  command?: string
): Promise<ValidationResult> {
  const startTime = Date.now()
  const cmd = command ?? 'npx tsc --noEmit'

  try {
    const output = await executor.execute('run_command', {
      command: cmd,
      timeout_ms: 120000 // 2 minutes
    })

    return {
      passed: true,
      gate: 'type-check',
      output,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const output = (error as Error).message

    return {
      passed: false,
      gate: 'type-check',
      output,
      duration: Date.now() - startTime,
      details: {
        errors: parseTypeScriptErrors(output)
      }
    }
  }
}

async function runLint(
  executor: ToolExecutor,
  command?: string
): Promise<ValidationResult> {
  const startTime = Date.now()
  const cmd = command ?? 'npm run lint'

  try {
    const output = await executor.execute('run_command', {
      command: cmd,
      timeout_ms: 120000
    })

    return {
      passed: true,
      gate: 'lint',
      output,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const output = (error as Error).message

    return {
      passed: false,
      gate: 'lint',
      output,
      duration: Date.now() - startTime,
      details: {
        errors: parseEslintErrors(output)
      }
    }
  }
}

async function runTests(
  executor: ToolExecutor,
  command?: string
): Promise<ValidationResult> {
  const startTime = Date.now()
  const cmd = command ?? 'npm run test'

  try {
    const output = await executor.execute('run_command', {
      command: cmd,
      timeout_ms: 600000 // 10 minutes
    })

    const testStats = parseTestOutput(output)

    return {
      passed: true,
      gate: 'test',
      output,
      duration: Date.now() - startTime,
      details: {
        coverage: testStats.coverage
      }
    }
  } catch (error) {
    const output = (error as Error).message
    const testStats = parseTestOutput(output)

    return {
      passed: false,
      gate: 'test',
      output,
      duration: Date.now() - startTime,
      details: {
        errors: testStats.failures.map(f => ({
          file: f.file,
          line: f.line ?? 0,
          column: 0,
          message: f.message,
          severity: 'error' as const
        }))
      }
    }
  }
}

async function runBuild(
  executor: ToolExecutor,
  command?: string
): Promise<ValidationResult> {
  const startTime = Date.now()
  const cmd = command ?? 'npm run build'

  try {
    const output = await executor.execute('run_command', {
      command: cmd,
      timeout_ms: 300000 // 5 minutes
    })

    return {
      passed: true,
      gate: 'build',
      output,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      passed: false,
      gate: 'build',
      output: (error as Error).message,
      duration: Date.now() - startTime,
    }
  }
}
```

### Error Parsers

```typescript
// lib/validation/parsers.ts

export function parseTypeScriptErrors(output: string): ValidationError[] {
  const errors: ValidationError[] = []
  const lines = output.split('\n')

  // Match: src/file.ts(10,5): error TS2322: Type 'string' is not assignable...
  const regex = /(.+)\((\d+),(\d+)\): error (TS\d+): (.+)/

  for (const line of lines) {
    const match = line.match(regex)
    if (match) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        message: match[5],
        rule: match[4],
        severity: 'error'
      })
    }
  }

  return errors
}

export function parseEslintErrors(output: string): ValidationError[] {
  const errors: ValidationError[] = []

  // Try parsing as JSON first (eslint -f json)
  try {
    const json = JSON.parse(output)
    for (const file of json) {
      for (const message of file.messages) {
        errors.push({
          file: file.filePath,
          line: message.line,
          column: message.column,
          message: message.message,
          rule: message.ruleId,
          severity: message.severity === 2 ? 'error' : 'warning'
        })
      }
    }
    return errors
  } catch {
    // Fall back to text parsing
  }

  // Match: /path/to/file.ts:10:5 - Error: message (rule-name)
  const regex = /(.+):(\d+):(\d+)\s+-\s+(Error|Warning):\s+(.+)\s+\((.+)\)/

  for (const line of output.split('\n')) {
    const match = line.match(regex)
    if (match) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        message: match[5],
        rule: match[6],
        severity: match[4].toLowerCase() as 'error' | 'warning'
      })
    }
  }

  return errors
}

export interface TestStats {
  total: number
  passed: number
  failed: number
  skipped: number
  failures: Array<{
    name: string
    file: string
    line?: number
    message: string
  }>
  coverage?: CoverageReport
}

export function parseTestOutput(output: string): TestStats {
  // This is framework-dependent, implement for Jest/Vitest/etc.
  const stats: TestStats = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    failures: []
  }

  // Jest format: Tests:       10 passed, 2 failed, 12 total
  const summaryMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed,\s+(\d+)\s+total/)
  if (summaryMatch) {
    stats.passed = parseInt(summaryMatch[1])
    stats.failed = parseInt(summaryMatch[2])
    stats.total = parseInt(summaryMatch[3])
  }

  // Parse failure blocks
  const failureRegex = /FAIL\s+(.+)\n[\s\S]*?●\s+(.+)\n\n([\s\S]*?)(?=\n\n|\z)/g
  let match
  while ((match = failureRegex.exec(output)) !== null) {
    stats.failures.push({
      file: match[1].trim(),
      name: match[2].trim(),
      message: match[3].trim()
    })
  }

  return stats
}
```

---

## Validation Recovery

### Handling Validation Failures

```typescript
// lib/validation/recovery.ts

export async function handleValidationFailure(
  job: AutonomousFixJob,
  result: ValidationResult,
  coordinator: CoordinatorState,
  executor: ToolExecutor
): Promise<'fixed' | 'failed' | 'escalate'> {

  const maxAttempts = 2

  if (job.validationAttempts >= maxAttempts) {
    await escalateToHuman(job.id, `Validation failed after ${maxAttempts} attempts: ${result.gate}`)
    return 'escalate'
  }

  // Build recovery context for agent
  const recoveryContext = buildRecoveryContext(result)

  // Ask coordinator to fix the validation issues
  const fixResult = await coordinator.fixValidationIssues(recoveryContext)

  if (fixResult.fixed) {
    // Re-run validation
    await db.update(autonomousFixJobs)
      .set({ validationAttempts: sql`validation_attempts + 1` })
      .where(eq(autonomousFixJobs.id, job.id))

    return 'fixed'
  }

  return 'failed'
}

function buildRecoveryContext(result: ValidationResult): string {
  let context = `The ${result.gate} validation failed.\n\n`
  context += `Output:\n\`\`\`\n${result.output.slice(0, 5000)}\n\`\`\`\n\n`

  if (result.details?.errors) {
    context += `Errors:\n`
    for (const error of result.details.errors.slice(0, 10)) {
      context += `- ${error.file}:${error.line}: ${error.message}\n`
    }
  }

  context += `\nPlease fix these issues and let me know when done.`

  return context
}
```

---

## PR Creation

### PR Content Builder

```typescript
// lib/pr/builder.ts

export interface PullRequestContent {
  title: string
  body: string
  labels: string[]
  assignees: string[]
  reviewers: string[]
}

export function buildPullRequest(
  bugReport: BugReport,
  job: AutonomousFixJob,
  coordinatorOutput: CoordinatorResult
): PullRequestContent {

  const title = buildPrTitle(bugReport, coordinatorOutput)
  const body = buildPrBody(bugReport, job, coordinatorOutput)
  const labels = determinePrLabels(bugReport, coordinatorOutput)

  return {
    title,
    body,
    labels,
    assignees: [], // Could auto-assign based on CODEOWNERS
    reviewers: [], // Could auto-request review
  }
}

function buildPrTitle(
  bugReport: BugReport,
  output: CoordinatorResult
): string {
  // Use conventional commit format
  const scope = bugReport.affectedFeature?.toLowerCase().replace(/\s+/g, '-') ?? 'core'
  const description = bugReport.title.slice(0, 50)

  return `fix(${scope}): ${description}`
}

function buildPrBody(
  bugReport: BugReport,
  job: AutonomousFixJob,
  output: CoordinatorResult
): string {
  return `## Summary

This pull request fixes the following bug:

> **${bugReport.title}**
>
> ${bugReport.description ?? 'No description provided.'}

---

## Root Cause Analysis

${output.rootCauseAnalysis}

---

## Solution

${output.proposedSolution}

---

## Changes Made

${output.filesChanged.map(f => `- \`${f}\``).join('\n')}

**Lines changed:** +${job.linesAdded ?? 0} / -${job.linesRemoved ?? 0}

---

## Verification

### Tests
${output.testResults.passed
  ? '✅ All tests pass'
  : `⚠️ Some tests needed attention:\n${output.testResults.summary}`
}

### Validation
- ✅ Type checking passed
- ✅ Linting passed
- ✅ Build succeeded

---

## Review Checklist

- [ ] Changes are minimal and focused on the bug fix
- [ ] No unrelated changes included
- [ ] Code follows existing patterns and conventions
- [ ] Edge cases are handled appropriately
- [ ] No security vulnerabilities introduced

---

## Links

- **Bug Report:** [#${bugReport.id.slice(0, 8)}](${getBugReportUrl(bugReport.id)})
- **Fix Job:** [#${job.id.slice(0, 8)}](${getFixJobUrl(job.id)})

---

<sub>🤖 This PR was created automatically by the Autonomous Bug-Fixing System.</sub>
<sub>Powered by Claude | [Learn more](https://placetostand.co/autonomous-fixes)</sub>
`
}

function determinePrLabels(
  bugReport: BugReport,
  output: CoordinatorResult
): string[] {
  const labels: string[] = ['autonomous-fix']

  // Add severity label
  if (bugReport.severity) {
    labels.push(`severity:${bugReport.severity.toLowerCase()}`)
  }

  // Add category label
  if (bugReport.category) {
    labels.push(`area:${bugReport.category.toLowerCase()}`)
  }

  return labels
}
```

### PR Creator

```typescript
// lib/pr/creator.ts

import { Octokit } from '@octokit/rest'

export async function createPullRequest(
  job: AutonomousFixJob,
  content: PullRequestContent
): Promise<{ number: number; url: string }> {

  const token = await getGitHubToken(job.githubRepoLinkId)
  const octokit = new Octokit({ auth: token })

  const [owner, repo] = job.repoFullName.split('/')

  // Create the PR
  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title: content.title,
    body: content.body,
    head: job.workingBranch!,
    base: job.baseBranch,
  })

  // Add labels
  if (content.labels.length > 0) {
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: pr.number,
      labels: content.labels,
    })
  }

  // Request reviewers (if configured)
  if (content.reviewers.length > 0) {
    await octokit.pulls.requestReviewers({
      owner,
      repo,
      pull_number: pr.number,
      reviewers: content.reviewers,
    })
  }

  return {
    number: pr.number,
    url: pr.html_url,
  }
}
```

### Git Operations

```typescript
// lib/pr/git-operations.ts

export async function prepareAndPush(
  job: AutonomousFixJob,
  executor: ToolExecutor,
  coordinatorOutput: CoordinatorResult
): Promise<void> {

  // Create branch
  const branchName = `fix/${slugify(job.bugReportId.slice(0, 8))}-${slugify(coordinatorOutput.commitMessage.slice(0, 30))}`

  await executor.execute('create_branch', { branch_name: branchName })

  // Update job with branch name
  await db.update(autonomousFixJobs)
    .set({ workingBranch: branchName })
    .where(eq(autonomousFixJobs.id, job.id))

  // Stage all changes
  await executor.execute('stage_changes', { paths: ['.'] })

  // Get diff stats
  const diffStats = await getDiffStats(executor)
  await db.update(autonomousFixJobs)
    .set({
      linesAdded: diffStats.additions,
      linesRemoved: diffStats.deletions,
    })
    .where(eq(autonomousFixJobs.id, job.id))

  // Create commit
  await executor.execute('create_commit', {
    message: coordinatorOutput.commitMessage
  })

  // Get commit SHA
  const commitSha = await executor.execute('run_command', {
    command: 'git rev-parse HEAD'
  })

  await db.update(autonomousFixJobs)
    .set({ fixCommitSha: commitSha.trim() })
    .where(eq(autonomousFixJobs.id, job.id))

  // Push to remote
  const token = await getGitHubToken(job.githubRepoLinkId)
  await executor.execute('run_command', {
    command: `git push -u origin ${branchName}`,
    timeout_ms: 60000 // 1 minute
  })
}

async function getDiffStats(executor: ToolExecutor): Promise<{ additions: number; deletions: number }> {
  const output = await executor.execute('run_command', {
    command: 'git diff --cached --stat | tail -1'
  })

  // Parse: 5 files changed, 50 insertions(+), 20 deletions(-)
  const match = output.match(/(\d+) insertions?\(\+\),?\s*(\d+) deletions?\(-\)/)

  return {
    additions: match ? parseInt(match[1]) : 0,
    deletions: match ? parseInt(match[2]) : 0,
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
```

---

## Post-PR Actions

### Update Records

```typescript
// lib/pr/post-creation.ts

export async function handlePrCreated(
  job: AutonomousFixJob,
  bugReport: BugReport,
  pr: { number: number; url: string }
): Promise<void> {

  // Update job
  await db.update(autonomousFixJobs)
    .set({
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      prNumber: pr.number,
      prUrl: pr.url,
    })
    .where(eq(autonomousFixJobs.id, job.id))

  // Update bug report
  await db.update(bugReports)
    .set({
      status: 'PR_CREATED',
      prUrl: pr.url,
    })
    .where(eq(bugReports.id, bugReport.id))

  // Log activity
  await logActivity({
    type: 'AUTONOMOUS_FIX_PR_CREATED',
    entityType: 'bug_report',
    entityId: bugReport.id,
    metadata: {
      prNumber: pr.number,
      prUrl: pr.url,
      jobId: job.id,
      filesChanged: job.filesChanged,
    }
  })

  // Notify client
  await notifyClientOfBugStatus(bugReport, 'PR_CREATED', `A fix is ready for review: ${pr.url}`)

  // Notify team
  await sendSlackNotification({
    channel: '#autonomous-fixes',
    text: `🤖 Autonomous fix created: ${pr.url}`,
    attachments: [{
      title: bugReport.title,
      text: job.rootCauseAnalysis?.slice(0, 200),
      color: 'good',
    }]
  })
}
```

### PR Merge Webhook

```typescript
// app/api/webhooks/github/route.ts

async function handlePullRequestEvent(payload: GitHubPullRequestPayload) {
  if (payload.action !== 'closed' || !payload.pull_request.merged) {
    return
  }

  // Find job by PR number and repo
  const job = await db.query.autonomousFixJobs.findFirst({
    where: and(
      eq(autonomousFixJobs.prNumber, payload.pull_request.number),
      eq(autonomousFixJobs.repoFullName, payload.repository.full_name)
    )
  })

  if (!job) return

  // Update job
  await db.update(autonomousFixJobs)
    .set({ status: 'MERGED' })
    .where(eq(autonomousFixJobs.id, job.id))

  // Update bug report
  await db.update(bugReports)
    .set({
      status: 'PR_MERGED',
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'AUTONOMOUS',
    })
    .where(eq(bugReports.id, job.bugReportId))

  // Get bug report for notification
  const bugReport = await db.query.bugReports.findFirst({
    where: eq(bugReports.id, job.bugReportId)
  })

  if (bugReport) {
    await notifyClientOfBugStatus(
      bugReport,
      'PR_MERGED',
      'Great news! Your bug has been fixed and the changes are now live.'
    )
  }

  // Track success metric
  await trackMetric('autonomous_fix_merged', {
    jobId: job.id,
    bugReportId: job.bugReportId,
    timeToMerge: Date.now() - new Date(job.queuedAt).getTime(),
  })
}
```

---

## Failed PR Handling

### PR Rejected

```typescript
async function handlePrRejected(
  job: AutonomousFixJob,
  bugReport: BugReport,
  reason: string
) {
  // Update job
  await db.update(autonomousFixJobs)
    .set({
      status: 'REJECTED',
      errorMessage: reason,
    })
    .where(eq(autonomousFixJobs.id, job.id))

  // Update bug report - might need another attempt or human
  await db.update(bugReports)
    .set({
      status: 'NEEDS_HUMAN',
      statusReason: `Autonomous fix was rejected: ${reason}`,
    })
    .where(eq(bugReports.id, bugReport.id))

  // Log for learning
  await logRejection({
    jobId: job.id,
    bugReportId: bugReport.id,
    reason,
    filesChanged: job.filesChanged,
    rootCause: job.rootCauseAnalysis,
    solution: job.proposedSolution,
  })

  // Alert team
  await sendAlert({
    type: 'AUTONOMOUS_FIX_REJECTED',
    jobId: job.id,
    reason,
  })
}
```

---

## Testing Requirements

### Unit Tests
- [ ] PR content is properly formatted
- [ ] Git operations execute correctly
- [ ] Validation pipeline runs gates in order
- [ ] Error parsers extract correct information

### Integration Tests
- [ ] Full validation pipeline with real code
- [ ] PR creation with GitHub API
- [ ] Webhook handling for PR events

### End-to-End Tests
- [ ] Complete flow from fix to merged PR

---

## Success Criteria

1. **Validation Accuracy:** 100% of PRs pass CI (no broken PRs)
2. **PR Quality:** >90% of PRs approved without changes
3. **Documentation:** All PRs have complete, helpful descriptions
4. **Merge Rate:** >80% of created PRs get merged
5. **Time to Review:** Average <4 hours from PR to first review

---

## Files to Create

```
lib/
├── validation/
│   ├── types.ts
│   ├── runner.ts
│   ├── parsers.ts
│   ├── recovery.ts
│   └── index.ts
├── pr/
│   ├── types.ts
│   ├── builder.ts
│   ├── creator.ts
│   ├── git-operations.ts
│   ├── post-creation.ts
│   └── index.ts
app/
├── api/
│   └── webhooks/
│       └── github/
│           └── route.ts  # Extended for PR events
```
