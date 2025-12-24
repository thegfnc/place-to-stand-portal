# Phase 6: Monitoring, Observability & Safety

**Status:** Planning
**Priority:** Critical (Production-readiness)
**Estimated Effort:** 2-3 weeks
**Dependencies:** All previous phases

---

## Overview

An autonomous system fixing code in production repositories requires comprehensive monitoring, observability, and safety controls. This phase implements the infrastructure to track system health, detect anomalies, control costs, and enable quick intervention when needed.

---

## Goals

1. **Visibility** - Real-time dashboards showing system state
2. **Alerting** - Immediate notification of problems
3. **Cost Control** - Budget limits and spending tracking
4. **Safety** - Kill switches and scope limits
5. **Audit Trail** - Complete history of all actions
6. **Learning** - Data collection for system improvement

---

## Monitoring Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            APPLICATION LAYER                                     │
│                                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Bug Intake  │  │  Fix Jobs   │  │   Agents    │  │     PR      │            │
│  │   Service   │  │   Worker    │  │  (Claude)   │  │  Creation   │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                │                │                │                    │
└─────────┴────────────────┴────────────────┴────────────────┴────────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           METRICS COLLECTOR                                      │
│                                                                                  │
│  - Request counts and latencies                                                  │
│  - Job queue depth and processing times                                         │
│  - Token usage and costs                                                         │
│  - Success/failure rates                                                         │
│  - Container resource usage                                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            STORAGE & ANALYSIS                                    │
│                                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Metrics   │  │    Logs     │  │   Traces    │  │   Alerts    │            │
│  │ (Prometheus)│  │ (Postgres/  │  │  (OpenTel)  │  │ (PagerDuty) │            │
│  │             │  │  CloudWatch)│  │             │  │             │            │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DASHBOARDS                                          │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        System Health Dashboard                           │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │    │
│  │  │ Queue Depth │  │ Success Rate│  │ Avg Fix Time│  │ Daily Cost  │    │    │
│  │  │     12      │  │    73%      │  │   14 min    │  │   $47.20    │    │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Table: `system_metrics`

```typescript
export const systemMetrics = pgTable('system_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Time bucket
  timestamp: timestamp('timestamp', { withTimezone: true, mode: 'string' }).notNull(),
  period: text('period').notNull(), // '1m', '5m', '1h', '1d'

  // Metric identification
  metricName: text('metric_name').notNull(),
  dimensions: jsonb('dimensions').$type<Record<string, string>>(),

  // Values
  count: integer('count'),
  sum: real('sum'),
  min: real('min'),
  max: real('max'),
  avg: real('avg'),
  p50: real('p50'),
  p95: real('p95'),
  p99: real('p99'),

  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
}, (table) => [
  index('idx_system_metrics_time_name')
    .on(table.timestamp.desc(), table.metricName),
  index('idx_system_metrics_name_time')
    .on(table.metricName, table.timestamp.desc()),
])
```

### Table: `cost_tracking`

```typescript
export const costTracking = pgTable('cost_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Time bucket
  date: date('date').notNull(),

  // Cost category
  category: text('category').notNull(), // 'claude_api', 'github_api', 'compute', 'storage'
  subCategory: text('sub_category'), // 'opus', 'haiku', 'sonnet'

  // Aggregated values
  totalCost: real('total_cost').notNull(),
  totalUnits: real('total_units').notNull(), // Tokens, API calls, minutes, etc.
  unitType: text('unit_type').notNull(), // 'tokens', 'calls', 'minutes', 'bytes'

  // Budget tracking
  budgetId: uuid('budget_id').references(() => costBudgets.id),
  budgetUsedPercent: real('budget_used_percent'),

  // Breakdown
  breakdown: jsonb('breakdown').$type<CostBreakdown[]>(),

  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
}, (table) => [
  index('idx_cost_tracking_date_category')
    .on(table.date.desc(), table.category),
  uniqueIndex('idx_cost_tracking_unique')
    .on(table.date, table.category, table.subCategory),
])
```

### Table: `cost_budgets`

```typescript
export const costBudgets = pgTable('cost_budgets', {
  id: uuid('id').primaryKey().defaultRandom(),

  name: text('name').notNull(),
  description: text('description'),

  // Budget period
  period: text('period').notNull(), // 'daily', 'weekly', 'monthly'
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('USD'),

  // Scope
  category: text('category'), // null = all categories
  clientId: uuid('client_id').references(() => clients.id), // null = all clients
  projectId: uuid('project_id').references(() => projects.id), // null = all projects

  // Alerting thresholds
  warnThresholdPercent: real('warn_threshold_percent').default(80),
  criticalThresholdPercent: real('critical_threshold_percent').default(95),
  hardLimitPercent: real('hard_limit_percent').default(100), // Block at this level

  // Status
  isActive: boolean('is_active').default(true),

  // Current period tracking
  currentPeriodStart: date('current_period_start'),
  currentPeriodSpend: real('current_period_spend').default(0),

  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
})
```

### Table: `safety_events`

```typescript
export const safetyEventTypeEnum = pgEnum('safety_event_type', [
  'BUDGET_WARNING',
  'BUDGET_EXCEEDED',
  'KILL_SWITCH_ACTIVATED',
  'SCOPE_VIOLATION',
  'RATE_LIMIT_HIT',
  'SUSPICIOUS_ACTIVITY',
  'MANUAL_OVERRIDE',
  'SYSTEM_ERROR',
])

export const safetyEvents = pgTable('safety_events', {
  id: uuid('id').primaryKey().defaultRandom(),

  eventType: safetyEventTypeEnum('event_type').notNull(),
  severity: text('severity').notNull(), // 'info', 'warning', 'critical'

  // Context
  jobId: uuid('job_id').references(() => autonomousFixJobs.id),
  bugReportId: uuid('bug_report_id').references(() => bugReports.id),
  clientId: uuid('client_id').references(() => clients.id),

  // Details
  title: text('title').notNull(),
  description: text('description'),
  metadata: jsonb('metadata'),

  // Response
  actionTaken: text('action_taken'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' }),
  resolvedBy: uuid('resolved_by').references(() => users.id),

  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
}, (table) => [
  index('idx_safety_events_type_time')
    .on(table.eventType, table.createdAt.desc()),
  index('idx_safety_events_severity')
    .on(table.severity, table.createdAt.desc())
    .where(sql`resolved_at IS NULL`),
])
```

---

## Metrics Collection

### Key Metrics

```typescript
// lib/monitoring/metrics.ts

export const METRICS = {
  // Queue metrics
  'queue.depth': 'Number of jobs waiting in queue',
  'queue.wait_time_ms': 'Time jobs spend in queue before processing',

  // Job metrics
  'job.started': 'Number of jobs started',
  'job.completed': 'Number of jobs completed successfully',
  'job.failed': 'Number of jobs that failed',
  'job.timeout': 'Number of jobs that timed out',
  'job.duration_ms': 'Total job duration',

  // Agent metrics
  'agent.iterations': 'Number of agent loop iterations',
  'agent.tool_calls': 'Number of tool calls made',
  'agent.tokens_prompt': 'Prompt tokens used',
  'agent.tokens_completion': 'Completion tokens used',

  // Validation metrics
  'validation.type_check_passed': 'Type checks that passed',
  'validation.type_check_failed': 'Type checks that failed',
  'validation.lint_passed': 'Lint checks that passed',
  'validation.lint_failed': 'Lint checks that failed',
  'validation.test_passed': 'Test runs that passed',
  'validation.test_failed': 'Test runs that failed',

  // PR metrics
  'pr.created': 'PRs created',
  'pr.merged': 'PRs merged',
  'pr.rejected': 'PRs rejected',
  'pr.time_to_merge_ms': 'Time from PR creation to merge',

  // Cost metrics
  'cost.claude_api': 'Claude API costs',
  'cost.github_api': 'GitHub API costs',
  'cost.compute': 'Container compute costs',

  // Error metrics
  'error.rate_limit': 'Rate limit errors',
  'error.api': 'API errors',
  'error.container': 'Container errors',
}

export async function recordMetric(
  name: keyof typeof METRICS,
  value: number,
  dimensions?: Record<string, string>
) {
  const timestamp = new Date()
  const minute = new Date(timestamp.setSeconds(0, 0))

  await db.insert(systemMetrics).values({
    timestamp: minute.toISOString(),
    period: '1m',
    metricName: name,
    dimensions,
    count: 1,
    sum: value,
    min: value,
    max: value,
    avg: value,
  }).onConflictDoUpdate({
    target: [systemMetrics.timestamp, systemMetrics.metricName],
    set: {
      count: sql`${systemMetrics.count} + 1`,
      sum: sql`${systemMetrics.sum} + ${value}`,
      min: sql`LEAST(${systemMetrics.min}, ${value})`,
      max: sql`GREATEST(${systemMetrics.max}, ${value})`,
      avg: sql`(${systemMetrics.sum} + ${value}) / (${systemMetrics.count} + 1)`,
    }
  })
}

export async function recordCounter(
  name: keyof typeof METRICS,
  dimensions?: Record<string, string>
) {
  await recordMetric(name, 1, dimensions)
}

export async function recordTimer(
  name: keyof typeof METRICS,
  durationMs: number,
  dimensions?: Record<string, string>
) {
  await recordMetric(name, durationMs, dimensions)
}
```

### Cost Tracking

```typescript
// lib/monitoring/cost-tracking.ts

const PRICING = {
  claude: {
    'claude-opus-4': { prompt: 15, completion: 75 }, // per 1M tokens
    'claude-sonnet-4': { prompt: 3, completion: 15 },
    'claude-3-5-haiku': { prompt: 0.8, completion: 4 },
  },
  compute: {
    containerMinute: 0.001, // $0.001 per container-minute
  }
}

export async function trackClaudeCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  jobId?: string
) {
  const modelPricing = PRICING.claude[model as keyof typeof PRICING.claude]
  if (!modelPricing) return

  const promptCost = (promptTokens / 1_000_000) * modelPricing.prompt
  const completionCost = (completionTokens / 1_000_000) * modelPricing.completion
  const totalCost = promptCost + completionCost

  const today = new Date().toISOString().split('T')[0]

  await db.insert(costTracking).values({
    date: today,
    category: 'claude_api',
    subCategory: model,
    totalCost,
    totalUnits: promptTokens + completionTokens,
    unitType: 'tokens',
    breakdown: [{
      type: 'prompt',
      units: promptTokens,
      cost: promptCost,
    }, {
      type: 'completion',
      units: completionTokens,
      cost: completionCost,
    }],
  }).onConflictDoUpdate({
    target: [costTracking.date, costTracking.category, costTracking.subCategory],
    set: {
      totalCost: sql`${costTracking.totalCost} + ${totalCost}`,
      totalUnits: sql`${costTracking.totalUnits} + ${promptTokens + completionTokens}`,
    }
  })

  // Check budgets
  await checkBudgets('claude_api', totalCost)

  // Record metric
  await recordMetric('cost.claude_api', totalCost, { model })
}

async function checkBudgets(category: string, additionalCost: number) {
  const activeBudgets = await db.query.costBudgets.findMany({
    where: and(
      eq(costBudgets.isActive, true),
      or(
        eq(costBudgets.category, category),
        isNull(costBudgets.category) // Global budgets
      )
    )
  })

  for (const budget of activeBudgets) {
    const newSpend = (budget.currentPeriodSpend ?? 0) + additionalCost
    const usedPercent = (newSpend / budget.amount) * 100

    // Update spend
    await db.update(costBudgets)
      .set({ currentPeriodSpend: newSpend })
      .where(eq(costBudgets.id, budget.id))

    // Check thresholds
    if (usedPercent >= budget.hardLimitPercent!) {
      await createSafetyEvent({
        eventType: 'BUDGET_EXCEEDED',
        severity: 'critical',
        title: `Budget "${budget.name}" exceeded hard limit`,
        description: `Spent $${newSpend.toFixed(2)} of $${budget.amount} budget (${usedPercent.toFixed(1)}%)`,
        metadata: { budgetId: budget.id, spent: newSpend, limit: budget.amount },
        actionTaken: 'Blocking new jobs',
      })

      // Activate kill switch for this budget scope
      await activateKillSwitch(budget)

    } else if (usedPercent >= budget.criticalThresholdPercent!) {
      await createSafetyEvent({
        eventType: 'BUDGET_WARNING',
        severity: 'critical',
        title: `Budget "${budget.name}" at critical level`,
        description: `Spent $${newSpend.toFixed(2)} of $${budget.amount} budget (${usedPercent.toFixed(1)}%)`,
        metadata: { budgetId: budget.id, spent: newSpend, limit: budget.amount },
      })

    } else if (usedPercent >= budget.warnThresholdPercent!) {
      await createSafetyEvent({
        eventType: 'BUDGET_WARNING',
        severity: 'warning',
        title: `Budget "${budget.name}" at warning level`,
        description: `Spent $${newSpend.toFixed(2)} of $${budget.amount} budget (${usedPercent.toFixed(1)}%)`,
        metadata: { budgetId: budget.id, spent: newSpend, limit: budget.amount },
      })
    }
  }
}
```

---

## Safety Controls

### Kill Switch

```typescript
// lib/monitoring/kill-switch.ts

export interface KillSwitchState {
  isActive: boolean
  activatedAt?: string
  activatedBy?: string
  reason?: string
  scope: 'global' | 'client' | 'project' | 'budget'
  scopeId?: string
}

const KILL_SWITCH_KEY = 'autonomous_fix_kill_switch'

export async function getKillSwitchState(): Promise<KillSwitchState[]> {
  // Could use Redis or DB
  const states = await db.query.systemSettings.findMany({
    where: like(systemSettings.key, `${KILL_SWITCH_KEY}%`)
  })

  return states.map(s => JSON.parse(s.value) as KillSwitchState)
}

export async function activateKillSwitch(
  scope: 'global' | 'client' | 'project' | 'budget',
  scopeId?: string,
  reason?: string,
  userId?: string
): Promise<void> {
  const key = scopeId ? `${KILL_SWITCH_KEY}_${scope}_${scopeId}` : KILL_SWITCH_KEY

  const state: KillSwitchState = {
    isActive: true,
    activatedAt: new Date().toISOString(),
    activatedBy: userId ?? 'system',
    reason,
    scope,
    scopeId,
  }

  await db.insert(systemSettings).values({
    key,
    value: JSON.stringify(state),
  }).onConflictDoUpdate({
    target: systemSettings.key,
    set: { value: JSON.stringify(state) }
  })

  await createSafetyEvent({
    eventType: 'KILL_SWITCH_ACTIVATED',
    severity: 'critical',
    title: `Kill switch activated (${scope})`,
    description: reason,
    metadata: { scope, scopeId },
    actionTaken: 'All matching jobs blocked',
  })

  // Cancel queued jobs in scope
  await cancelQueuedJobsInScope(scope, scopeId)

  // Alert team
  await sendPagerDutyAlert({
    severity: 'critical',
    summary: `Autonomous fix kill switch activated: ${reason}`,
    source: 'autonomous-fix-system',
    customDetails: { scope, scopeId, reason },
  })
}

export async function deactivateKillSwitch(
  scope: 'global' | 'client' | 'project' | 'budget',
  scopeId?: string,
  userId: string
): Promise<void> {
  const key = scopeId ? `${KILL_SWITCH_KEY}_${scope}_${scopeId}` : KILL_SWITCH_KEY

  await db.delete(systemSettings)
    .where(eq(systemSettings.key, key))

  await createSafetyEvent({
    eventType: 'MANUAL_OVERRIDE',
    severity: 'info',
    title: `Kill switch deactivated (${scope})`,
    metadata: { scope, scopeId, deactivatedBy: userId },
  })
}

export async function isKillSwitchActive(
  clientId?: string,
  projectId?: string,
  budgetId?: string
): Promise<{ active: boolean; reason?: string }> {
  const states = await getKillSwitchState()

  // Check global kill switch
  const globalSwitch = states.find(s => s.scope === 'global' && s.isActive)
  if (globalSwitch) {
    return { active: true, reason: globalSwitch.reason }
  }

  // Check client-specific
  if (clientId) {
    const clientSwitch = states.find(s => s.scope === 'client' && s.scopeId === clientId && s.isActive)
    if (clientSwitch) {
      return { active: true, reason: clientSwitch.reason }
    }
  }

  // Check project-specific
  if (projectId) {
    const projectSwitch = states.find(s => s.scope === 'project' && s.scopeId === projectId && s.isActive)
    if (projectSwitch) {
      return { active: true, reason: projectSwitch.reason }
    }
  }

  // Check budget-specific
  if (budgetId) {
    const budgetSwitch = states.find(s => s.scope === 'budget' && s.scopeId === budgetId && s.isActive)
    if (budgetSwitch) {
      return { active: true, reason: budgetSwitch.reason }
    }
  }

  return { active: false }
}
```

### Scope Limits

```typescript
// lib/monitoring/scope-limits.ts

export const SCOPE_LIMITS = {
  // File limits
  maxFilesChanged: 50,
  maxLinesChanged: 5000,
  maxFileSizeKb: 1024,

  // Forbidden paths (regex patterns)
  forbiddenPaths: [
    /\.env/,
    /secrets?\./,
    /credentials?\./,
    /\.pem$/,
    /\.key$/,
    /password/i,
    /api[_-]?key/i,
    /node_modules\//,
    /\.git\//,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/,
  ],

  // Forbidden operations
  forbiddenOperations: [
    'rm -rf',
    'DROP TABLE',
    'DROP DATABASE',
    'TRUNCATE',
    'DELETE FROM .* WHERE 1=1',
    'sudo',
    'chmod 777',
    'curl .* | sh',
    'eval(',
    'exec(',
  ],

  // Token budgets per model
  tokenBudgets: {
    'claude-opus-4': 200000,
    'claude-sonnet-4': 300000,
    'claude-3-5-haiku': 500000,
  },

  // Time limits
  maxJobDurationMs: 30 * 60 * 1000, // 30 minutes
  maxAgentIterations: 50,
}

export function checkScopeLimits(
  operation: 'file_write' | 'file_read' | 'command' | 'token_usage',
  context: Record<string, unknown>
): { allowed: boolean; reason?: string } {

  switch (operation) {
    case 'file_write': {
      const path = context.path as string

      // Check forbidden paths
      for (const pattern of SCOPE_LIMITS.forbiddenPaths) {
        if (pattern.test(path)) {
          return {
            allowed: false,
            reason: `Writing to forbidden path: ${path}`
          }
        }
      }

      // Check file size
      const size = context.size as number
      if (size > SCOPE_LIMITS.maxFileSizeKb * 1024) {
        return {
          allowed: false,
          reason: `File too large: ${size} bytes`
        }
      }

      return { allowed: true }
    }

    case 'command': {
      const command = context.command as string

      // Check forbidden operations
      for (const pattern of SCOPE_LIMITS.forbiddenOperations) {
        const regex = new RegExp(pattern, 'i')
        if (regex.test(command)) {
          return {
            allowed: false,
            reason: `Forbidden command pattern: ${pattern}`
          }
        }
      }

      return { allowed: true }
    }

    case 'token_usage': {
      const model = context.model as string
      const used = context.used as number
      const limit = SCOPE_LIMITS.tokenBudgets[model as keyof typeof SCOPE_LIMITS.tokenBudgets]

      if (limit && used > limit) {
        return {
          allowed: false,
          reason: `Token budget exceeded for ${model}: ${used}/${limit}`
        }
      }

      return { allowed: true }
    }

    default:
      return { allowed: true }
  }
}
```

---

## Alerting

### Alert Configuration

```typescript
// lib/monitoring/alerts.ts

export interface AlertRule {
  id: string
  name: string
  metric: string
  condition: 'gt' | 'lt' | 'eq' | 'ne'
  threshold: number
  windowMinutes: number
  severity: 'info' | 'warning' | 'critical'
  channels: ('email' | 'slack' | 'pagerduty')[]
}

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'high_failure_rate',
    name: 'High Job Failure Rate',
    metric: 'job.failed',
    condition: 'gt',
    threshold: 50, // 50% failure rate
    windowMinutes: 60,
    severity: 'critical',
    channels: ['slack', 'pagerduty'],
  },
  {
    id: 'queue_backup',
    name: 'Queue Backup',
    metric: 'queue.depth',
    condition: 'gt',
    threshold: 50,
    windowMinutes: 15,
    severity: 'warning',
    channels: ['slack'],
  },
  {
    id: 'high_token_usage',
    name: 'High Token Usage',
    metric: 'agent.tokens_prompt',
    condition: 'gt',
    threshold: 100000, // Average tokens per job
    windowMinutes: 60,
    severity: 'warning',
    channels: ['email', 'slack'],
  },
  {
    id: 'budget_warning',
    name: 'Daily Budget Warning',
    metric: 'cost.claude_api',
    condition: 'gt',
    threshold: 100, // $100/day
    windowMinutes: 1440, // 24 hours
    severity: 'warning',
    channels: ['email', 'slack'],
  },
]

export async function evaluateAlerts() {
  for (const rule of DEFAULT_ALERT_RULES) {
    const metricValue = await getMetricValue(rule.metric, rule.windowMinutes)

    let triggered = false
    switch (rule.condition) {
      case 'gt': triggered = metricValue > rule.threshold; break
      case 'lt': triggered = metricValue < rule.threshold; break
      case 'eq': triggered = metricValue === rule.threshold; break
      case 'ne': triggered = metricValue !== rule.threshold; break
    }

    if (triggered) {
      await triggerAlert(rule, metricValue)
    }
  }
}

async function triggerAlert(rule: AlertRule, value: number) {
  // Check if already alerted recently (dedup)
  const recentAlert = await db.query.safetyEvents.findFirst({
    where: and(
      eq(safetyEvents.title, rule.name),
      gt(safetyEvents.createdAt, new Date(Date.now() - 30 * 60 * 1000).toISOString()) // 30 min
    )
  })

  if (recentAlert) return // Already alerted

  // Create safety event
  await createSafetyEvent({
    eventType: 'SYSTEM_ERROR',
    severity: rule.severity,
    title: rule.name,
    description: `${rule.metric} is ${value} (threshold: ${rule.threshold})`,
    metadata: { ruleId: rule.id, value, threshold: rule.threshold },
  })

  // Send to channels
  for (const channel of rule.channels) {
    switch (channel) {
      case 'slack':
        await sendSlackAlert(rule, value)
        break
      case 'pagerduty':
        await sendPagerDutyAlert({
          severity: rule.severity === 'critical' ? 'critical' : 'warning',
          summary: `${rule.name}: ${value} (threshold: ${rule.threshold})`,
          source: 'autonomous-fix-system',
        })
        break
      case 'email':
        await sendEmailAlert(rule, value)
        break
    }
  }
}
```

---

## Dashboard

### Dashboard API

```typescript
// app/api/dashboard/autonomous-fixes/route.ts

export async function GET(req: Request) {
  const user = await requireUser()
  await assertAdmin(user)

  const [
    queueStats,
    jobStats,
    costStats,
    recentJobs,
    activeAlerts,
  ] = await Promise.all([
    getQueueStats(),
    getJobStats(),
    getCostStats(),
    getRecentJobs(10),
    getActiveAlerts(),
  ])

  return NextResponse.json({
    ok: true,
    data: {
      queue: queueStats,
      jobs: jobStats,
      costs: costStats,
      recentJobs,
      activeAlerts,
      killSwitchStatus: await getKillSwitchState(),
    }
  })
}

async function getQueueStats() {
  const [queued] = await db
    .select({ count: sql<number>`count(*)` })
    .from(autonomousFixJobs)
    .where(eq(autonomousFixJobs.status, 'QUEUED'))

  const [running] = await db
    .select({ count: sql<number>`count(*)` })
    .from(autonomousFixJobs)
    .where(inArray(autonomousFixJobs.status, ['PROVISIONING', 'CLONING', 'ANALYZING', 'IMPLEMENTING', 'TESTING', 'VALIDATING', 'COMMITTING', 'PUSHING', 'CREATING_PR']))

  return {
    queued: queued.count,
    running: running.count,
  }
}

async function getJobStats() {
  const today = new Date().toISOString().split('T')[0]

  const stats = await db
    .select({
      status: autonomousFixJobs.status,
      count: sql<number>`count(*)`,
    })
    .from(autonomousFixJobs)
    .where(gte(autonomousFixJobs.createdAt, today))
    .groupBy(autonomousFixJobs.status)

  const total = stats.reduce((sum, s) => sum + s.count, 0)
  const completed = stats.find(s => s.status === 'COMPLETED')?.count ?? 0
  const failed = stats.find(s => s.status === 'FAILED')?.count ?? 0

  return {
    total,
    completed,
    failed,
    successRate: total > 0 ? (completed / total) * 100 : 0,
  }
}

async function getCostStats() {
  const today = new Date().toISOString().split('T')[0]

  const [todayCost] = await db
    .select({ total: sql<number>`sum(total_cost)` })
    .from(costTracking)
    .where(eq(costTracking.date, today))

  const [monthCost] = await db
    .select({ total: sql<number>`sum(total_cost)` })
    .from(costTracking)
    .where(gte(costTracking.date, new Date().toISOString().slice(0, 7) + '-01'))

  return {
    today: todayCost.total ?? 0,
    month: monthCost.total ?? 0,
  }
}
```

---

## Audit Trail

### Comprehensive Logging

```typescript
// lib/monitoring/audit.ts

export interface AuditLogEntry {
  timestamp: string
  eventType: string
  actorType: 'system' | 'user' | 'agent'
  actorId?: string
  targetType: string
  targetId: string
  action: string
  details: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export async function logAuditEvent(entry: Omit<AuditLogEntry, 'timestamp'>) {
  await db.insert(auditLogs).values({
    ...entry,
    timestamp: new Date().toISOString(),
  })
}

// Audit everything
export const AUDIT_EVENTS = {
  // Bug reports
  'bug_report.created': 'Bug report received',
  'bug_report.linked': 'Bug report linked to project',
  'bug_report.status_changed': 'Bug report status changed',

  // Fix jobs
  'fix_job.queued': 'Fix job queued',
  'fix_job.started': 'Fix job started',
  'fix_job.completed': 'Fix job completed',
  'fix_job.failed': 'Fix job failed',
  'fix_job.cancelled': 'Fix job cancelled',

  // Agent actions
  'agent.file_read': 'Agent read a file',
  'agent.file_write': 'Agent wrote a file',
  'agent.command_run': 'Agent ran a command',
  'agent.branch_created': 'Agent created a branch',
  'agent.commit_created': 'Agent created a commit',

  // PRs
  'pr.created': 'Pull request created',
  'pr.merged': 'Pull request merged',
  'pr.rejected': 'Pull request rejected',

  // Safety
  'safety.kill_switch_activated': 'Kill switch activated',
  'safety.kill_switch_deactivated': 'Kill switch deactivated',
  'safety.budget_exceeded': 'Budget exceeded',
  'safety.scope_violation': 'Scope violation detected',
}
```

---

## Testing Requirements

### Unit Tests
- [ ] Metric recording works correctly
- [ ] Cost calculations are accurate
- [ ] Alert rules evaluate correctly
- [ ] Kill switch logic works

### Integration Tests
- [ ] Metrics persist to database
- [ ] Alerts trigger correctly
- [ ] Dashboard API returns correct data
- [ ] Kill switch blocks jobs

### Load Tests
- [ ] Metric recording under high load
- [ ] Alert evaluation doesn't slow down

---

## Success Criteria

1. **Observability:** 100% of job states visible in real-time
2. **Alert Response:** Critical alerts delivered within 1 minute
3. **Cost Accuracy:** Cost tracking within 1% of actual spend
4. **Kill Switch:** Can halt all jobs within 30 seconds
5. **Audit Coverage:** 100% of actions logged

---

## Files to Create

```
lib/
├── monitoring/
│   ├── types.ts
│   ├── metrics.ts
│   ├── cost-tracking.ts
│   ├── alerts.ts
│   ├── kill-switch.ts
│   ├── scope-limits.ts
│   ├── audit.ts
│   └── index.ts
app/
├── api/
│   └── dashboard/
│       └── autonomous-fixes/
│           └── route.ts
├── (dashboard)/
│   └── autonomous-fixes/
│       └── page.tsx  # Dashboard UI
```
