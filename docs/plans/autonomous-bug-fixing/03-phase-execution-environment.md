# Phase 3: Execution Environment

**Status:** Planning
**Priority:** Critical (Enables agent execution)
**Estimated Effort:** 2-3 weeks
**Dependencies:** Docker infrastructure, Cloud provider setup

---

## Overview

The autonomous bug-fixing agents need a secure, isolated environment to clone repositories, read/write code, run tests, and execute git operations. This phase establishes the sandboxed execution infrastructure that protects both client code and our systems.

---

## Goals

1. **Isolation** - Each fix job runs in its own container with no access to other jobs
2. **Security** - No access to production data, secrets are scoped and rotated
3. **Reproducibility** - Same environment for every execution
4. **Resource Control** - CPU, memory, and time limits prevent runaway jobs
5. **Cleanup** - Automatic cleanup of all artifacts after job completion
6. **Scalability** - Can run multiple jobs in parallel

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           JOB ORCHESTRATOR                                       │
│                    (Runs in main application context)                            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         JOB QUEUE (Redis/PostgreSQL)                             │
│  - Pending jobs with priority                                                    │
│  - Job metadata and configuration                                                │
│  - Retry tracking                                                                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           WORKER POOL                                            │
│              (Kubernetes pods or Docker containers)                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                       WORKER CONTAINER                                   │    │
│  │                                                                          │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │    │
│  │  │                    EXECUTION SANDBOX                             │    │    │
│  │  │                                                                  │    │    │
│  │  │  /workspace/                                                     │    │    │
│  │  │  └── repo/          ← Cloned repository                          │    │    │
│  │  │                                                                  │    │    │
│  │  │  Capabilities:                                                   │    │    │
│  │  │  ✓ Read/write files in /workspace                                │    │    │
│  │  │  ✓ Execute npm/yarn/pnpm commands                                │    │    │
│  │  │  ✓ Run tests                                                     │    │    │
│  │  │  ✓ Git operations (branch, commit, push)                         │    │    │
│  │  │  ✗ Network access (except GitHub API)                            │    │    │
│  │  │  ✗ Access to host filesystem                                     │    │    │
│  │  │  ✗ Access to other containers                                    │    │    │
│  │  └─────────────────────────────────────────────────────────────────┘    │    │
│  │                                                                          │    │
│  │  Resource Limits:                                                        │    │
│  │  - CPU: 2 cores                                                          │    │
│  │  - Memory: 4GB                                                           │    │
│  │  - Disk: 10GB                                                            │    │
│  │  - Time: 30 minutes max                                                  │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  [Worker 1]  [Worker 2]  [Worker 3]  ...  [Worker N]                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ARTIFACT STORAGE                                         │
│  - Execution logs                                                                │
│  - Generated diffs                                                               │
│  - Test results                                                                  │
│  - (Cleaned up after PR creation or failure)                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Container Specification

### Base Image

```dockerfile
# Dockerfile.worker

FROM node:20-bookworm-slim

# Install essential tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    jq \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install common package managers
RUN npm install -g pnpm yarn

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Create workspace directory
RUN mkdir -p /workspace && chmod 777 /workspace

# Create non-root user for execution
RUN useradd -m -s /bin/bash worker
USER worker

WORKDIR /workspace

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Entry point is the worker process
COPY --chown=worker:worker worker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["/usr/local/bin/worker-entrypoint.sh"]
```

### Worker Entry Point

```bash
#!/bin/bash
# worker-entrypoint.sh

set -e

# Start the worker process
exec node /app/worker.js
```

---

## Database Schema

### Table: `autonomous_fix_jobs`

```typescript
// lib/db/schema.ts

export const fixJobStatusEnum = pgEnum('fix_job_status', [
  'QUEUED',           // Waiting in queue
  'PROVISIONING',     // Container being created
  'CLONING',          // Cloning repository
  'ANALYZING',        // Claude analyzing the bug
  'IMPLEMENTING',     // Claude writing the fix
  'TESTING',          // Running tests
  'VALIDATING',       // Lint, type check
  'COMMITTING',       // Creating commit
  'PUSHING',          // Pushing to remote
  'CREATING_PR',      // Creating pull request
  'COMPLETED',        // Successfully created PR
  'FAILED',           // Job failed
  'CANCELLED',        // Job cancelled
  'TIMEOUT',          // Job exceeded time limit
])

export const autonomousFixJobs = pgTable('autonomous_fix_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Link to bug report
  bugReportId: uuid('bug_report_id')
    .references(() => bugReports.id)
    .notNull(),

  // Repository info
  githubRepoLinkId: uuid('github_repo_link_id')
    .references(() => githubRepoLinks.id)
    .notNull(),
  repoFullName: text('repo_full_name').notNull(),
  baseBranch: text('base_branch').notNull().default('main'),

  // Execution environment
  containerId: text('container_id'),
  workerId: text('worker_id'),
  workspacePath: text('workspace_path'),

  // Git details
  workingBranch: text('working_branch'),
  baseCommitSha: text('base_commit_sha'),
  fixCommitSha: text('fix_commit_sha'),

  // Status
  status: fixJobStatusEnum('status').default('QUEUED').notNull(),
  statusMessage: text('status_message'),

  // Progress tracking
  currentStep: text('current_step'),
  progressPercent: integer('progress_percent').default(0),

  // Timing
  queuedAt: timestamp('queued_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),

  // Time limits
  timeoutAt: timestamp('timeout_at', { withTimezone: true, mode: 'string' }),
  maxDurationMs: integer('max_duration_ms').default(1800000), // 30 minutes

  // Results
  prNumber: integer('pr_number'),
  prUrl: text('pr_url'),

  // Agent outputs
  rootCauseAnalysis: text('root_cause_analysis'),
  proposedSolution: text('proposed_solution'),
  implementationPlan: text('implementation_plan'),
  filesChanged: text('files_changed').array(),
  linesAdded: integer('lines_added'),
  linesRemoved: integer('lines_removed'),

  // Test results
  testsRun: integer('tests_run'),
  testsPassed: integer('tests_passed'),
  testsFailed: integer('tests_failed'),
  testOutput: text('test_output'),

  // Validation results
  lintPassed: boolean('lint_passed'),
  lintOutput: text('lint_output'),
  typeCheckPassed: boolean('type_check_passed'),
  typeCheckOutput: text('type_check_output'),

  // Error handling
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),
  errorStep: text('error_step'),

  // Retry tracking
  retryCount: integer('retry_count').default(0),
  maxRetries: integer('max_retries').default(3),
  previousJobId: uuid('previous_job_id'), // If this is a retry

  // Cost tracking
  totalTokensUsed: integer('total_tokens_used'),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  estimatedCost: real('estimated_cost'),

  // Codebase knowledge used
  codebaseKnowledgeId: uuid('codebase_knowledge_id')
    .references(() => codebaseKnowledge.id),
  knowledgeCommitSha: text('knowledge_commit_sha'),

  // Standard timestamps
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
}, (table) => [
  index('idx_fix_jobs_status')
    .on(table.status),
  index('idx_fix_jobs_bug_report')
    .on(table.bugReportId),
  index('idx_fix_jobs_queued')
    .on(table.queuedAt)
    .where(sql`status = 'QUEUED'`),
])
```

### Table: `job_execution_steps`

Detailed step-by-step tracking.

```typescript
export const jobExecutionSteps = pgTable('job_execution_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  fixJobId: uuid('fix_job_id')
    .references(() => autonomousFixJobs.id, { onDelete: 'cascade' })
    .notNull(),

  // Step details
  stepName: text('step_name').notNull(),
  stepOrder: integer('step_order').notNull(),

  // Timing
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
  durationMs: integer('duration_ms'),

  // Result
  status: text('status').notNull(), // RUNNING, SUCCESS, FAILED, SKIPPED
  output: text('output'),
  errorMessage: text('error_message'),

  // Metadata
  metadata: jsonb('metadata'),

  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
}, (table) => [
  index('idx_job_execution_steps_job')
    .on(table.fixJobId),
])
```

---

## Job Queue Implementation

### Queue Manager

```typescript
// lib/execution/queue.ts

import { db } from '@/lib/db'
import { autonomousFixJobs } from '@/lib/db/schema'

export interface QueueJobInput {
  bugReportId: string
  githubRepoLinkId: string
  repoFullName: string
  baseBranch: string
  priority?: 'high' | 'normal' | 'low'
  codebaseKnowledgeId?: string
}

export async function queueFixJob(input: QueueJobInput): Promise<string> {
  const [job] = await db.insert(autonomousFixJobs).values({
    bugReportId: input.bugReportId,
    githubRepoLinkId: input.githubRepoLinkId,
    repoFullName: input.repoFullName,
    baseBranch: input.baseBranch,
    codebaseKnowledgeId: input.codebaseKnowledgeId,
    status: 'QUEUED',
    queuedAt: new Date().toISOString(),
    timeoutAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
  }).returning()

  // Update bug report status
  await db.update(bugReports)
    .set({
      status: 'FIX_QUEUED',
      currentFixJobId: job.id,
      fixAttemptCount: sql`fix_attempt_count + 1`,
    })
    .where(eq(bugReports.id, input.bugReportId))

  return job.id
}

export async function getNextJob(): Promise<AutonomousFixJob | null> {
  // Get oldest queued job that hasn't timed out
  const [job] = await db
    .select()
    .from(autonomousFixJobs)
    .where(
      and(
        eq(autonomousFixJobs.status, 'QUEUED'),
        gt(autonomousFixJobs.timeoutAt, new Date().toISOString())
      )
    )
    .orderBy(autonomousFixJobs.queuedAt.asc())
    .limit(1)
    .for('update', { skipLocked: true }) // Prevent race conditions

  if (!job) return null

  // Mark as provisioning
  await db.update(autonomousFixJobs)
    .set({
      status: 'PROVISIONING',
      startedAt: new Date().toISOString(),
    })
    .where(eq(autonomousFixJobs.id, job.id))

  return job
}
```

### Worker Process

```typescript
// lib/execution/worker.ts

import { Docker } from 'dockerode'

const docker = new Docker()

export class FixJobWorker {
  private workerId: string
  private running: boolean = false

  constructor() {
    this.workerId = `worker-${crypto.randomUUID().slice(0, 8)}`
  }

  async start() {
    this.running = true
    console.log(`[${this.workerId}] Starting worker...`)

    while (this.running) {
      try {
        const job = await getNextJob()

        if (job) {
          await this.executeJob(job)
        } else {
          // No jobs available, wait before polling again
          await sleep(5000)
        }
      } catch (error) {
        console.error(`[${this.workerId}] Error:`, error)
        await sleep(10000) // Back off on errors
      }
    }
  }

  async stop() {
    this.running = false
  }

  private async executeJob(job: AutonomousFixJob) {
    const containerId = await this.provisionContainer(job)

    try {
      await this.updateJobStatus(job.id, 'CLONING')
      await this.cloneRepository(containerId, job)

      await this.updateJobStatus(job.id, 'ANALYZING')
      const analysis = await this.runAnalysisAgent(containerId, job)

      await this.updateJobStatus(job.id, 'IMPLEMENTING')
      const implementation = await this.runImplementationAgent(containerId, job, analysis)

      await this.updateJobStatus(job.id, 'TESTING')
      const testResults = await this.runTests(containerId, job)

      if (!testResults.passed) {
        // Try to fix test failures
        const fixedImplementation = await this.fixTestFailures(containerId, job, testResults)
        const retestResults = await this.runTests(containerId, job)

        if (!retestResults.passed) {
          throw new Error(`Tests still failing after fix attempt: ${retestResults.summary}`)
        }
      }

      await this.updateJobStatus(job.id, 'VALIDATING')
      await this.runValidation(containerId, job)

      await this.updateJobStatus(job.id, 'COMMITTING')
      await this.createCommit(containerId, job, analysis, implementation)

      await this.updateJobStatus(job.id, 'PUSHING')
      await this.pushBranch(containerId, job)

      await this.updateJobStatus(job.id, 'CREATING_PR')
      const pr = await this.createPullRequest(job, analysis, implementation)

      await this.completeJob(job.id, pr)

    } catch (error) {
      await this.failJob(job.id, error as Error)
    } finally {
      await this.cleanupContainer(containerId)
    }
  }

  private async provisionContainer(job: AutonomousFixJob): Promise<string> {
    const container = await docker.createContainer({
      Image: 'pts-fix-worker:latest',
      Env: [
        `JOB_ID=${job.id}`,
        `GITHUB_TOKEN=${await getGitHubToken(job.githubRepoLinkId)}`,
        `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`,
      ],
      HostConfig: {
        Memory: 4 * 1024 * 1024 * 1024, // 4GB
        CpuShares: 2048, // 2 CPU cores
        DiskQuota: 10 * 1024 * 1024 * 1024, // 10GB
        NetworkMode: 'bridge', // Limited network
        SecurityOpt: ['no-new-privileges'],
        ReadonlyRootfs: false, // Need to write to workspace
        Binds: [], // No host mounts
      },
      WorkingDir: '/workspace',
    })

    await container.start()

    await db.update(autonomousFixJobs)
      .set({
        containerId: container.id,
        workerId: this.workerId,
        workspacePath: '/workspace/repo',
      })
      .where(eq(autonomousFixJobs.id, job.id))

    return container.id
  }

  private async cloneRepository(containerId: string, job: AutonomousFixJob) {
    const container = docker.getContainer(containerId)

    // Clone with depth=1 for speed, then fetch more if needed
    const exec = await container.exec({
      Cmd: [
        'git', 'clone',
        '--depth', '100',
        '--branch', job.baseBranch,
        `https://x-access-token:${await getGitHubToken(job.githubRepoLinkId)}@github.com/${job.repoFullName}.git`,
        'repo'
      ],
      WorkingDir: '/workspace',
    })

    await exec.start({ Detach: false })

    // Record base commit SHA
    const shaExec = await container.exec({
      Cmd: ['git', 'rev-parse', 'HEAD'],
      WorkingDir: '/workspace/repo',
    })
    const shaResult = await shaExec.start({ Detach: false })
    const baseSha = await streamToString(shaResult)

    await db.update(autonomousFixJobs)
      .set({ baseCommitSha: baseSha.trim() })
      .where(eq(autonomousFixJobs.id, job.id))
  }

  private async cleanupContainer(containerId: string) {
    try {
      const container = docker.getContainer(containerId)
      await container.stop({ t: 10 })
      await container.remove({ force: true })
    } catch (error) {
      console.error(`Failed to cleanup container ${containerId}:`, error)
    }
  }
}
```

---

## Security Measures

### Network Isolation

```yaml
# docker-compose.workers.yml

networks:
  fix-workers:
    driver: bridge
    internal: true # No external access by default

  github-access:
    driver: bridge
    # Allows access only to GitHub IPs

services:
  fix-worker:
    networks:
      - fix-workers
      - github-access
    dns:
      - 8.8.8.8 # Only for GitHub resolution
```

### Secret Management

```typescript
// lib/execution/secrets.ts

interface JobSecrets {
  githubToken: string
  anthropicApiKey: string
}

export async function getJobSecrets(job: AutonomousFixJob): Promise<JobSecrets> {
  // Get GitHub token from OAuth connection
  const repoLink = await db.query.githubRepoLinks.findFirst({
    where: eq(githubRepoLinks.id, job.githubRepoLinkId),
    with: { oauthConnection: true }
  })

  if (!repoLink?.oauthConnection) {
    throw new Error('No OAuth connection for repository')
  }

  const githubToken = await decryptToken(repoLink.oauthConnection.accessToken)

  return {
    githubToken,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  }
}

// Tokens are injected as env vars, not files
// Tokens are rotated after job completion
// Tokens are scoped to specific repos where possible
```

### Resource Limits

```typescript
// lib/execution/limits.ts

export const JOB_LIMITS = {
  // Time limits
  maxDurationMs: 30 * 60 * 1000, // 30 minutes
  cloneTimeoutMs: 5 * 60 * 1000, // 5 minutes for clone
  testTimeoutMs: 10 * 60 * 1000, // 10 minutes for tests

  // Resource limits
  maxMemoryMb: 4096, // 4GB
  maxCpuCores: 2,
  maxDiskGb: 10,

  // Token limits (cost control)
  maxTotalTokens: 500000, // ~$10 at Opus rates
  maxPromptTokens: 200000,
  maxCompletionTokens: 300000,

  // File limits
  maxFilesChanged: 50,
  maxLinesChanged: 5000,
  maxFileSizeKb: 1024, // 1MB per file

  // Retry limits
  maxRetries: 3,
  retryDelayMs: 60000, // 1 minute between retries
}

export function checkLimits(job: AutonomousFixJob): void {
  const now = Date.now()
  const startTime = new Date(job.startedAt!).getTime()

  if (now - startTime > JOB_LIMITS.maxDurationMs) {
    throw new TimeoutError('Job exceeded maximum duration')
  }

  if (job.totalTokensUsed && job.totalTokensUsed > JOB_LIMITS.maxTotalTokens) {
    throw new LimitExceededError('Token limit exceeded')
  }
}
```

---

## Timeout and Cleanup

### Timeout Handler

```typescript
// lib/execution/timeout-handler.ts

export async function checkForTimeouts() {
  // Find jobs that have exceeded their timeout
  const timedOutJobs = await db
    .select()
    .from(autonomousFixJobs)
    .where(
      and(
        inArray(autonomousFixJobs.status, [
          'PROVISIONING', 'CLONING', 'ANALYZING',
          'IMPLEMENTING', 'TESTING', 'VALIDATING',
          'COMMITTING', 'PUSHING', 'CREATING_PR'
        ]),
        lt(autonomousFixJobs.timeoutAt, new Date().toISOString())
      )
    )

  for (const job of timedOutJobs) {
    console.log(`Job ${job.id} timed out, cleaning up...`)

    // Kill container if running
    if (job.containerId) {
      try {
        const container = docker.getContainer(job.containerId)
        await container.kill()
        await container.remove({ force: true })
      } catch (error) {
        console.error(`Failed to kill container ${job.containerId}:`, error)
      }
    }

    // Update job status
    await db.update(autonomousFixJobs)
      .set({
        status: 'TIMEOUT',
        completedAt: new Date().toISOString(),
        errorMessage: `Job timed out after ${JOB_LIMITS.maxDurationMs / 1000 / 60} minutes`,
        errorStep: job.status,
      })
      .where(eq(autonomousFixJobs.id, job.id))

    // Update bug report
    await db.update(bugReports)
      .set({
        status: 'FAILED',
        statusReason: 'Fix job timed out',
      })
      .where(eq(bugReports.id, job.bugReportId))

    // Alert team
    await sendAlert({
      type: 'FIX_JOB_TIMEOUT',
      jobId: job.id,
      bugReportId: job.bugReportId,
    })
  }
}

// Run every minute
setInterval(checkForTimeouts, 60000)
```

### Cleanup Service

```typescript
// lib/execution/cleanup.ts

export async function cleanupOldArtifacts() {
  const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago

  // Find completed/failed jobs older than 24 hours
  const oldJobs = await db
    .select()
    .from(autonomousFixJobs)
    .where(
      and(
        inArray(autonomousFixJobs.status, ['COMPLETED', 'FAILED', 'TIMEOUT', 'CANCELLED']),
        lt(autonomousFixJobs.completedAt, cutoffDate.toISOString())
      )
    )

  for (const job of oldJobs) {
    // Remove any lingering containers
    if (job.containerId) {
      try {
        const container = docker.getContainer(job.containerId)
        await container.remove({ force: true })
      } catch (error) {
        // Container likely already removed
      }
    }

    // Clear large text fields to save storage
    await db.update(autonomousFixJobs)
      .set({
        testOutput: null,
        lintOutput: null,
        typeCheckOutput: null,
        // Keep root cause, solution, and implementation for analysis
      })
      .where(eq(autonomousFixJobs.id, job.id))
  }
}

// Run daily
```

---

## Scaling Strategy

### Horizontal Scaling

```yaml
# kubernetes/workers.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: fix-workers
spec:
  replicas: 3 # Start with 3 workers
  selector:
    matchLabels:
      app: fix-worker
  template:
    metadata:
      labels:
        app: fix-worker
    spec:
      containers:
        - name: worker
          image: pts-fix-worker:latest
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "500m"
          env:
            - name: WORKER_CONCURRENCY
              value: "2" # Each worker can run 2 jobs
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: fix-workers-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: fix-workers
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: External
      external:
        metric:
          name: fix_job_queue_depth
        target:
          type: AverageValue
          averageValue: 5 # Scale up when queue > 5 jobs per worker
```

### Queue Depth Monitoring

```typescript
// lib/execution/metrics.ts

export async function getQueueMetrics() {
  const [queueDepth] = await db
    .select({ count: sql<number>`count(*)` })
    .from(autonomousFixJobs)
    .where(eq(autonomousFixJobs.status, 'QUEUED'))

  const [runningJobs] = await db
    .select({ count: sql<number>`count(*)` })
    .from(autonomousFixJobs)
    .where(
      inArray(autonomousFixJobs.status, [
        'PROVISIONING', 'CLONING', 'ANALYZING',
        'IMPLEMENTING', 'TESTING', 'VALIDATING',
        'COMMITTING', 'PUSHING', 'CREATING_PR'
      ])
    )

  return {
    queueDepth: queueDepth.count,
    runningJobs: runningJobs.count,
    timestamp: new Date().toISOString(),
  }
}
```

---

## API Endpoints

### POST `/api/fix-jobs`

Queue a new fix job.

```typescript
export async function POST(req: Request) {
  const user = await requireUser()
  await assertAdmin(user)

  const body = await req.json()

  const job = await queueFixJob({
    bugReportId: body.bugReportId,
    githubRepoLinkId: body.githubRepoLinkId,
    repoFullName: body.repoFullName,
    baseBranch: body.baseBranch ?? 'main',
  })

  return NextResponse.json({ ok: true, data: { jobId: job } })
}
```

### GET `/api/fix-jobs/:id`

Get job status and details.

### POST `/api/fix-jobs/:id/cancel`

Cancel a running job.

### POST `/api/fix-jobs/:id/retry`

Retry a failed job.

### GET `/api/fix-jobs/queue`

Get queue status and metrics.

---

## Testing Requirements

### Unit Tests
- [ ] Queue operations (add, get next, update)
- [ ] Container provisioning
- [ ] Timeout detection
- [ ] Cleanup logic

### Integration Tests
- [ ] Full job execution flow
- [ ] Container lifecycle
- [ ] Git operations in container
- [ ] Resource limit enforcement

### Load Tests
- [ ] Multiple concurrent jobs
- [ ] Queue depth handling
- [ ] Resource contention

---

## Success Criteria

1. **Reliability:** >99% of jobs complete without infrastructure issues
2. **Isolation:** Zero cross-job data leakage
3. **Performance:** Container provisioning <30 seconds
4. **Scalability:** Handle 10 concurrent jobs without degradation
5. **Cleanup:** 100% of containers cleaned up within 1 hour of completion

---

## Files to Create

```
lib/
├── execution/
│   ├── types.ts
│   ├── queue.ts
│   ├── worker.ts
│   ├── container.ts
│   ├── secrets.ts
│   ├── limits.ts
│   ├── timeout-handler.ts
│   ├── cleanup.ts
│   ├── metrics.ts
│   └── index.ts
├── queries/
│   └── fix-jobs.ts
├── data/
│   └── fix-jobs/
│       └── index.ts
app/
├── api/
│   └── fix-jobs/
│       ├── route.ts
│       ├── [id]/
│       │   ├── route.ts
│       │   ├── cancel/
│       │   │   └── route.ts
│       │   └── retry/
│       │       └── route.ts
│       └── queue/
│           └── route.ts
docker/
├── Dockerfile.worker
├── docker-compose.workers.yml
└── worker-entrypoint.sh
kubernetes/
└── workers.yaml
```
