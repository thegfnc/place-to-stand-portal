# Phase 0: Job Queue Infrastructure

**Status:** Planning
**Priority:** CRITICAL (Blocks all other phases)
**Estimated Effort:** 1 week
**Dependencies:** PostgreSQL (existing via Supabase)

---

## Overview

The current Place to Stand portal has no background job processing. All operations are synchronous request/response. The Autonomous Bug-Fixing System requires:

1. **Async job execution** - Fix jobs can take 30+ minutes
2. **Job queuing** - Multiple bugs may arrive simultaneously
3. **Retry logic** - Failed jobs should retry with backoff
4. **Status tracking** - Know where each job is in the pipeline
5. **Dead letter queue** - Handle permanently failed jobs

This phase establishes the foundational job queue infrastructure that all subsequent phases depend on.

---

## Why This Is Needed

### Current State (Synchronous)
```
Client Request → Server Processing → Response (must complete in <30s for Vercel)
```

### Required State (Asynchronous)
```
Client Request → Queue Job → Response (immediate)
                    ↓
              Worker picks up job
                    ↓
              Long-running processing (up to 30 min)
                    ↓
              Status updates stored in DB
                    ↓
              Webhook/notification on completion
```

---

## Technology Decision

### Option A: pg-boss (Recommended)

**Pros:**
- Uses existing PostgreSQL (no new infrastructure)
- Battle-tested, mature library
- Built-in retry, exponential backoff, dead letter queue
- Job scheduling and cron support
- TypeScript support
- Easy to debug (jobs are in DB)

**Cons:**
- Adds ~50KB to bundle
- Requires connection pooling awareness

```typescript
// Example usage
import PgBoss from 'pg-boss';

const boss = new PgBoss(process.env.DATABASE_URL);
await boss.start();

// Producer
await boss.send('fix-bug', { bugReportId: 'uuid', priority: 1 });

// Worker
await boss.work('fix-bug', async (job) => {
  const { bugReportId } = job.data;
  await processFixJob(bugReportId);
});
```

### Option B: BullMQ + Redis

**Pros:**
- Industry standard for job queues
- More features (rate limiting, priorities, flows)
- Better for high-volume scenarios

**Cons:**
- Requires Redis (new infrastructure)
- More complexity
- Additional cost

### Option C: Custom PostgreSQL Queue

**Pros:**
- No new dependencies
- Full control
- Minimal overhead

**Cons:**
- Need to implement retry, backoff, dead letter queue
- Need to handle race conditions
- More code to maintain

### Recommendation: pg-boss

Given our existing PostgreSQL infrastructure and the complexity requirements, pg-boss is the best fit. It provides all needed features without requiring new infrastructure.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER (Next.js)                                 │
│                                                                                  │
│  POST /api/bug-reports/intake          POST /api/codebase/analyze               │
│           │                                      │                               │
│           ▼                                      ▼                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         JOB PRODUCER                                     │    │
│  │                                                                          │    │
│  │  boss.send('process-bug-report', { bugReportId })                       │    │
│  │  boss.send('analyze-codebase', { repoLinkId })                          │    │
│  │  boss.send('execute-fix', { fixJobId })                                 │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PostgreSQL (Supabase)                               │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         pgboss schema                                    │    │
│  │                                                                          │    │
│  │  job table:                                                              │    │
│  │  - id, name, data, state, retrylimit, retrycount                        │    │
│  │  - startedon, completedon, priority, expirein                           │    │
│  │  - createdon, keepuntil, output                                         │    │
│  │                                                                          │    │
│  │  archive table:                                                          │    │
│  │  - Completed/failed jobs moved here                                      │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              WORKER PROCESS                                      │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         JOB CONSUMER                                     │    │
│  │                                                                          │    │
│  │  boss.work('process-bug-report', processBugReport)                      │    │
│  │  boss.work('analyze-codebase', analyzeCodebase)                         │    │
│  │  boss.work('execute-fix', executeFix)                                   │    │
│  │                                                                          │    │
│  │  Features:                                                               │    │
│  │  - Concurrency control (1 fix job at a time per worker)                 │    │
│  │  - Automatic retry with exponential backoff                             │    │
│  │  - Dead letter queue for failed jobs                                    │    │
│  │  - Job timeout handling                                                 │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Job Types

### 1. `process-bug-report`
Parse and enrich incoming bug reports.

```typescript
interface ProcessBugReportJob {
  bugReportId: string;
}

// Options
{
  retryLimit: 3,
  retryDelay: 30, // seconds
  retryBackoff: true, // exponential
  expireInMinutes: 10,
}
```

### 2. `analyze-codebase`
Analyze a linked repository.

```typescript
interface AnalyzeCodebaseJob {
  repoLinkId: string;
  fullAnalysis: boolean; // vs incremental
  triggeredBy: 'link' | 'webhook' | 'manual';
}

// Options
{
  retryLimit: 2,
  retryDelay: 60,
  retryBackoff: true,
  expireInMinutes: 30,
}
```

### 3. `execute-fix`
Run the autonomous fix workflow.

```typescript
interface ExecuteFixJob {
  fixJobId: string;
  bugReportId: string;
  repoLinkId: string;
  codebaseKnowledgeId: string;
}

// Options
{
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
  expireInMinutes: 45,
  priority: 1, // Higher priority
}
```

### 4. `cleanup-container`
Cleanup after fix job completes.

```typescript
interface CleanupContainerJob {
  containerId: string;
  fixJobId: string;
}

// Options
{
  retryLimit: 5,
  retryDelay: 10,
  expireInMinutes: 5,
}
```

### 5. `send-notification`
Send status notifications.

```typescript
interface SendNotificationJob {
  type: 'bug_received' | 'fix_started' | 'pr_created' | 'fix_failed';
  bugReportId: string;
  recipientEmail: string;
  data: Record<string, unknown>;
}

// Options
{
  retryLimit: 3,
  retryDelay: 30,
  expireInMinutes: 60,
}
```

---

## Implementation

### Database Setup

pg-boss creates its own schema. No manual migration needed.

```typescript
// lib/jobs/client.ts
import PgBoss from 'pg-boss';

let boss: PgBoss | null = null;

export async function getJobClient(): Promise<PgBoss> {
  if (boss) return boss;

  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    schema: 'pgboss', // Separate schema

    // Archive completed jobs for 7 days
    archiveCompletedAfterSeconds: 7 * 24 * 60 * 60,

    // Delete archived jobs after 30 days
    deleteAfterDays: 30,

    // Monitoring
    monitorStateIntervalSeconds: 30,

    // Maintenance
    maintenanceIntervalSeconds: 120,
  });

  boss.on('error', (error) => {
    console.error('[pg-boss] Error:', error);
    // Alert team
  });

  boss.on('monitor-states', (states) => {
    // Log job states for monitoring
    console.log('[pg-boss] States:', states);
  });

  await boss.start();
  return boss;
}

export async function stopJobClient(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
  }
}
```

### Job Producer

```typescript
// lib/jobs/producer.ts
import { getJobClient } from './client';

export async function queueBugReportProcessing(bugReportId: string): Promise<string> {
  const boss = await getJobClient();

  const jobId = await boss.send('process-bug-report',
    { bugReportId },
    {
      retryLimit: 3,
      retryDelay: 30,
      retryBackoff: true,
      expireInMinutes: 10,
    }
  );

  return jobId!;
}

export async function queueCodebaseAnalysis(
  repoLinkId: string,
  options: { fullAnalysis?: boolean; triggeredBy?: string } = {}
): Promise<string> {
  const boss = await getJobClient();

  const jobId = await boss.send('analyze-codebase',
    {
      repoLinkId,
      fullAnalysis: options.fullAnalysis ?? true,
      triggeredBy: options.triggeredBy ?? 'manual',
    },
    {
      retryLimit: 2,
      retryDelay: 60,
      retryBackoff: true,
      expireInMinutes: 30,

      // Dedupe: only one analysis per repo at a time
      singletonKey: `analyze-${repoLinkId}`,
      singletonMinutes: 5,
    }
  );

  return jobId!;
}

export async function queueFixExecution(
  fixJobId: string,
  bugReportId: string,
  repoLinkId: string,
  codebaseKnowledgeId: string
): Promise<string> {
  const boss = await getJobClient();

  const jobId = await boss.send('execute-fix',
    {
      fixJobId,
      bugReportId,
      repoLinkId,
      codebaseKnowledgeId,
    },
    {
      retryLimit: 3,
      retryDelay: 60,
      retryBackoff: true,
      expireInMinutes: 45,
      priority: 1,
    }
  );

  return jobId!;
}

export async function queueNotification(
  type: string,
  bugReportId: string,
  recipientEmail: string,
  data: Record<string, unknown>
): Promise<string> {
  const boss = await getJobClient();

  const jobId = await boss.send('send-notification',
    { type, bugReportId, recipientEmail, data },
    {
      retryLimit: 3,
      retryDelay: 30,
      expireInMinutes: 60,
    }
  );

  return jobId!;
}
```

### Job Workers

```typescript
// lib/jobs/workers/index.ts
import { getJobClient } from '../client';
import { processBugReport } from './process-bug-report';
import { analyzeCodebase } from './analyze-codebase';
import { executeFix } from './execute-fix';
import { sendNotification } from './send-notification';
import { cleanupContainer } from './cleanup-container';

export async function startWorkers(): Promise<void> {
  const boss = await getJobClient();

  // Bug report processing - can run many in parallel
  await boss.work('process-bug-report', { teamConcurrency: 5 }, processBugReport);

  // Codebase analysis - limit to 2 concurrent
  await boss.work('analyze-codebase', { teamConcurrency: 2 }, analyzeCodebase);

  // Fix execution - limit to 1 at a time per worker (resource intensive)
  await boss.work('execute-fix', { teamConcurrency: 1 }, executeFix);

  // Notifications - can run many in parallel
  await boss.work('send-notification', { teamConcurrency: 10 }, sendNotification);

  // Cleanup - can run many in parallel
  await boss.work('cleanup-container', { teamConcurrency: 5 }, cleanupContainer);

  console.log('[Workers] All workers started');
}
```

### Worker Process Entry Point

```typescript
// worker.ts (run as separate process)
import 'dotenv/config';
import { startWorkers } from './lib/jobs/workers';
import { getJobClient, stopJobClient } from './lib/jobs/client';

async function main() {
  console.log('[Worker] Starting job workers...');

  await startWorkers();

  console.log('[Worker] Workers running. Press Ctrl+C to stop.');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[Worker] SIGTERM received, shutting down...');
    await stopJobClient();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[Worker] SIGINT received, shutting down...');
    await stopJobClient();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('[Worker] Fatal error:', error);
  process.exit(1);
});
```

---

## Deployment Options

### Option 1: Separate Worker Process (Recommended for Production)

```yaml
# docker-compose.yml addition
services:
  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    restart: unless-stopped
    depends_on:
      - db
```

### Option 2: Vercel Cron + API Routes (Simpler, Limited)

For MVP, use Vercel cron to poll for jobs:

```typescript
// app/api/cron/process-jobs/route.ts
import { getJobClient } from '@/lib/jobs/client';

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const boss = await getJobClient();

  // Fetch and process one job of each type
  // Note: Limited by Vercel function timeout (10s on hobby, 60s on pro)

  const job = await boss.fetch('process-bug-report');
  if (job) {
    await processBugReport(job);
    await boss.complete(job.id);
  }

  return Response.json({ ok: true });
}
```

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/process-jobs",
    "schedule": "* * * * *"
  }]
}
```

**Limitation:** Vercel functions have timeouts. For long-running fix jobs, need dedicated worker.

### Option 3: Hybrid

- Use Vercel cron for quick jobs (notifications, bug parsing)
- Use dedicated worker for long jobs (fix execution)

---

## Monitoring

### Job Queue Dashboard

```typescript
// app/api/admin/job-queue/route.ts
export async function GET(req: Request) {
  const user = await requireUser();
  await assertAdmin(user);

  const boss = await getJobClient();

  // Get queue stats
  const [
    activeCount,
    completedCount,
    failedCount,
    queuedCount,
  ] = await Promise.all([
    boss.getQueueSize('process-bug-report', { state: 'active' }),
    boss.getQueueSize('process-bug-report', { state: 'completed' }),
    boss.getQueueSize('process-bug-report', { state: 'failed' }),
    boss.getQueueSize('process-bug-report', { state: 'created' }),
  ]);

  // Get recent failed jobs
  const failedJobs = await boss.fetch('*', 10, { state: 'failed' });

  return Response.json({
    ok: true,
    data: {
      queues: {
        'process-bug-report': { activeCount, completedCount, failedCount, queuedCount },
        // Add other queues...
      },
      recentFailures: failedJobs,
    }
  });
}
```

### Alerting

```typescript
// lib/jobs/workers/error-handler.ts
export async function handleJobError(
  jobName: string,
  jobId: string,
  error: Error,
  retryCount: number,
  maxRetries: number
): Promise<void> {
  console.error(`[${jobName}] Job ${jobId} failed:`, error);

  // Track metric
  await recordMetric('job.failed', 1, { jobName });

  // Alert on final failure
  if (retryCount >= maxRetries) {
    await sendSlackAlert({
      channel: '#autonomous-fixes',
      text: `🚨 Job permanently failed: ${jobName}`,
      attachments: [{
        color: 'danger',
        fields: [
          { title: 'Job ID', value: jobId, short: true },
          { title: 'Retries', value: `${retryCount}/${maxRetries}`, short: true },
          { title: 'Error', value: error.message },
        ],
      }],
    });
  }
}
```

---

## Testing

### Unit Tests

```typescript
// __tests__/jobs/producer.test.ts
import { queueBugReportProcessing } from '@/lib/jobs/producer';

describe('Job Producer', () => {
  it('should queue bug report processing', async () => {
    const jobId = await queueBugReportProcessing('test-bug-id');
    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });
});
```

### Integration Tests

```typescript
// __tests__/jobs/integration.test.ts
describe('Job Queue Integration', () => {
  it('should process job end-to-end', async () => {
    // Queue job
    const jobId = await queueBugReportProcessing('test-bug-id');

    // Wait for processing
    await waitForJobCompletion(jobId, 10000);

    // Verify result
    const bugReport = await getBugReport('test-bug-id');
    expect(bugReport.status).toBe('PARSED');
  });
});
```

---

## Files to Create

```
lib/
├── jobs/
│   ├── client.ts              # pg-boss client singleton
│   ├── producer.ts            # Job queueing functions
│   ├── types.ts               # Job type definitions
│   ├── workers/
│   │   ├── index.ts           # Worker registration
│   │   ├── process-bug-report.ts
│   │   ├── analyze-codebase.ts
│   │   ├── execute-fix.ts
│   │   ├── send-notification.ts
│   │   ├── cleanup-container.ts
│   │   └── error-handler.ts
│   └── index.ts               # Public exports
worker.ts                      # Worker process entry point
Dockerfile.worker              # Worker container image
app/
└── api/
    └── admin/
        └── job-queue/
            └── route.ts       # Queue monitoring endpoint
```

---

## Success Criteria

1. **Reliability:** 99.9% job delivery rate
2. **Performance:** Job pickup latency <1 second
3. **Retry Success:** >80% of retried jobs eventually succeed
4. **Visibility:** All job states visible in monitoring dashboard
5. **Graceful Shutdown:** No job loss on worker restart

---

## Dependencies for package.json

```json
{
  "dependencies": {
    "pg-boss": "^9.0.0"
  }
}
```

---

## Migration Checklist

- [ ] Add pg-boss dependency
- [ ] Create job client module
- [ ] Create producer functions
- [ ] Create worker implementations
- [ ] Create worker entry point
- [ ] Add Dockerfile.worker
- [ ] Update docker-compose.yml
- [ ] Add monitoring endpoint
- [ ] Add alerting integration
- [ ] Write tests
- [ ] Deploy worker to production
