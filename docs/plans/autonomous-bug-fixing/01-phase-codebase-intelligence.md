# Phase 1: Codebase Intelligence Layer

**Status:** Planning
**Priority:** Critical (Foundation for all other phases)
**Estimated Effort:** 2-3 weeks

---

## Overview

When a GitHub repository is linked to a client project, we trigger a comprehensive analysis that extracts structured knowledge about the codebase. This pre-computed intelligence gives Claude agents a "head start" when fixing bugs - they understand the architecture, patterns, and conventions before attempting any changes.

---

## Goals

1. **Eliminate cold-start latency** - No exploring the codebase from scratch for each bug
2. **Improve fix quality** - Claude follows existing patterns and conventions
3. **Reduce token usage** - Pre-computed knowledge is more efficient than re-discovery
4. **Enable faster triage** - System understands which parts of code relate to which features

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         REPO LINKED TO PROJECT                                   │
│                    (Trigger: POST /api/projects/:id/github-repos)               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    CODEBASE ANALYSIS JOB CREATED                                 │
│                    Status: QUEUED → CLONING → ANALYZING → READY                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CLONE REPOSITORY                                         │
│               Shallow clone of default branch to temp directory                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
        ┌───────────────┬───────────────┼───────────────┬───────────────┐
        │               │               │               │               │
        ▼               ▼               ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ ARCHITECTURE│ │ API/ROUTES  │ │   SCHEMA    │ │   TESTING   │ │ CONVENTIONS │
│    AGENT    │ │    AGENT    │ │    AGENT    │ │    AGENT    │ │    AGENT    │
│  (Haiku)    │ │  (Haiku)    │ │  (Haiku)    │ │  (Haiku)    │ │  (Haiku)    │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
        │               │               │               │               │
        └───────────────┴───────────────┼───────────────┴───────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      SYNTHESIS AGENT (Sonnet)                                    │
│   Combines all agent outputs → Creates unified summary → Validates consistency   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    STORE IN codebase_knowledge TABLE                             │
│                    Status: READY | Cleanup temp directory                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Table: `codebase_knowledge`

```typescript
// lib/db/schema.ts

export const codebaseKnowledgeStatusEnum = pgEnum('codebase_knowledge_status', [
  'PENDING',    // Job created, waiting to start
  'CLONING',    // Cloning repository
  'ANALYZING',  // Agents analyzing codebase
  'READY',      // Analysis complete, knowledge available
  'FAILED',     // Analysis failed
  'STALE',      // Knowledge outdated (new commits since analysis)
])

export const codebaseKnowledge = pgTable('codebase_knowledge', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Link to repository
  githubRepoLinkId: uuid('github_repo_link_id')
    .references(() => githubRepoLinks.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),

  // Version tracking
  commitSha: text('commit_sha').notNull(),
  branchName: text('branch_name').notNull().default('main'),
  analyzedAt: timestamp('analyzed_at', { withTimezone: true, mode: 'string' }),

  // Status
  status: codebaseKnowledgeStatusEnum('status').default('PENDING').notNull(),

  // Structured knowledge (JSONB for queryability)
  architecture: jsonb('architecture').$type<ArchitectureKnowledge>(),
  apiRoutes: jsonb('api_routes').$type<ApiRoutesKnowledge>(),
  databaseSchema: jsonb('database_schema').$type<DatabaseSchemaKnowledge>(),
  testingInfo: jsonb('testing_info').$type<TestingKnowledge>(),
  conventions: jsonb('conventions').$type<ConventionsKnowledge>(),

  // Condensed summary (~2000 tokens, fits easily in context)
  summary: text('summary'),

  // File index for quick lookups
  fileIndex: jsonb('file_index').$type<FileIndexEntry[]>(),

  // Analysis metadata
  totalFilesAnalyzed: integer('total_files_analyzed'),
  totalLinesOfCode: integer('total_lines_of_code'),
  primaryLanguage: text('primary_language'),
  frameworkDetected: text('framework_detected'),

  // Cost tracking
  totalTokensUsed: integer('total_tokens_used'),
  analysisTimeMs: integer('analysis_time_ms'),
  estimatedCost: real('estimated_cost'),

  // Error handling
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),
  retryCount: integer('retry_count').default(0),

  // Standard timestamps
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
}, (table) => [
  index('idx_codebase_knowledge_repo_link')
    .on(table.githubRepoLinkId),
  index('idx_codebase_knowledge_status')
    .on(table.status),
])
```

### Table: `codebase_analysis_logs`

```typescript
export const codebaseAnalysisLogs = pgTable('codebase_analysis_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  codebaseKnowledgeId: uuid('codebase_knowledge_id')
    .references(() => codebaseKnowledge.id, { onDelete: 'cascade' })
    .notNull(),

  // Agent identification
  agentType: text('agent_type').notNull(), // ARCHITECTURE, API, SCHEMA, TESTING, CONVENTIONS, SYNTHESIS
  agentModel: text('agent_model').notNull(), // claude-3-haiku, claude-sonnet-4, etc.

  // Execution details
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
  durationMs: integer('duration_ms'),

  // Input/Output (for debugging)
  filesAnalyzed: text('files_analyzed').array(),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),

  // Result
  status: text('status').notNull(), // SUCCESS, FAILED, TIMEOUT
  outputSummary: text('output_summary'), // Brief summary of what was found
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
}, (table) => [
  index('idx_codebase_analysis_logs_knowledge_id')
    .on(table.codebaseKnowledgeId),
])
```

---

## Knowledge Type Definitions

```typescript
// lib/types/codebase-knowledge.ts

export interface ArchitectureKnowledge {
  // Framework and language
  framework: string // "Next.js 16 (App Router)", "Express", "Django", etc.
  language: string // "TypeScript", "Python", "Go"
  languageVersion?: string // "5.3", "3.11", "1.21"
  packageManager: string // "npm", "yarn", "pnpm", "pip", "go mod"

  // Directory structure with purposes
  directoryStructure: Record<string, string> // { "app/": "Next.js routes", "lib/": "Business logic" }

  // Key files that are important entry points
  keyFiles: Array<{
    path: string
    purpose: string
    importance: 'critical' | 'high' | 'medium'
  }>

  // Major dependencies and their purposes
  dependencies: Array<{
    name: string
    version: string
    purpose: string
    category: 'database' | 'auth' | 'ui' | 'testing' | 'utility' | 'api' | 'other'
  }>

  // Architectural patterns used
  patterns: string[] // ["Server Components", "Repository pattern", "CQRS"]

  // Build and run commands
  commands: {
    dev: string
    build: string
    test: string
    lint?: string
    typeCheck?: string
  }

  // Environment requirements
  environmentVariables: Array<{
    name: string
    required: boolean
    description: string
  }>
}

export interface ApiRoutesKnowledge {
  // Route organization
  routeGroups: Record<string, string> // { "(auth)": "Unauthenticated routes" }

  // Base URL pattern
  baseUrl?: string
  apiVersioning?: string // "v1", "date-based", etc.

  // All endpoints
  endpoints: Array<{
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    path: string
    file: string
    description: string
    authentication: 'none' | 'required' | 'optional'
    authMethod?: string // "Bearer token", "Session cookie", etc.
    permissions?: string[] // ["admin", "client_member"]
    requestBody?: string // Brief description or schema reference
    responseFormat: string // "{ ok: boolean, data?: T, error?: string }"
    relatedTables?: string[] // Database tables this endpoint touches
  }>

  // Authentication patterns
  authPatterns: {
    sessionCheck: string // Function/file for session validation
    roleCheck?: string // Function for role-based access
    resourceAccess?: string // Function for resource-level permissions
  }

  // Common response patterns
  responsePatterns: {
    success: string // Example success response shape
    error: string // Example error response shape
  }

  // Middleware
  middleware: Array<{
    name: string
    appliesTo: string // "all", "api/*", etc.
    purpose: string
  }>
}

export interface DatabaseSchemaKnowledge {
  // ORM and database
  orm: string // "Drizzle", "Prisma", "TypeORM", "raw SQL"
  database: string // "PostgreSQL", "MySQL", "SQLite"
  connectionString?: string // env var name, not actual value

  // Schema file location
  schemaFile: string // "lib/db/schema.ts", "prisma/schema.prisma"
  migrationsDir: string // "drizzle/migrations/", "prisma/migrations/"

  // All tables with details
  tables: Record<string, {
    primaryKey: string
    columns: Array<{
      name: string
      type: string
      nullable: boolean
      default?: string
    }>
    relations: Array<{
      type: 'one-to-one' | 'one-to-many' | 'many-to-many'
      relatedTable: string
      foreignKey?: string
      throughTable?: string // For many-to-many
    }>
    indexes: string[]
    softDelete: boolean
    timestamps: boolean
  }>

  // Enums
  enums: Record<string, string[]>

  // Migration commands
  migrationCommands: {
    generate: string // "npm run db:generate -- --name <name>"
    apply: string // "npm run db:migrate"
    status?: string
  }

  // Common query patterns
  queryPatterns: {
    location: string // "lib/queries/"
    examples: Array<{
      name: string
      file: string
      description: string
    }>
  }
}

export interface TestingKnowledge {
  // Test framework
  framework: string // "Jest", "Vitest", "Playwright", "pytest"
  configFile?: string // "jest.config.js", "vitest.config.ts"

  // Commands
  commands: {
    runAll: string // "npm run test"
    runSingle: string // "npm run test -- path/to/test"
    coverage?: string // "npm run test:coverage"
    watch?: string // "npm run test:watch"
  }

  // Test file patterns
  patterns: {
    locations: string[] // ["__tests__/", "*.test.ts", "*.spec.ts"]
    namingConvention: string // "*.test.ts for unit, *.spec.ts for integration"
  }

  // Test types present
  testTypes: {
    unit: boolean
    integration: boolean
    e2e: boolean
    snapshot: boolean
  }

  // Coverage info
  coverage?: {
    current: number // Percentage
    threshold?: number
    uncoveredAreas: string[] // Areas with low coverage
  }

  // Source-to-test mapping
  testMapping: Array<{
    sourcePattern: string // "lib/queries/*.ts"
    testPattern: string // "__tests__/queries/*.test.ts"
  }>

  // Test utilities and helpers
  utilities: Array<{
    file: string
    purpose: string
  }>

  // Common test patterns in this codebase
  commonPatterns: string[] // ["Factory functions for fixtures", "Mocked Supabase client"]
}

export interface ConventionsKnowledge {
  // Naming conventions
  naming: {
    files: string // "kebab-case for files, PascalCase for components"
    variables: string // "camelCase"
    constants: string // "UPPER_SNAKE_CASE"
    types: string // "PascalCase with descriptive suffixes"
    functions: string // "camelCase, verb-first for actions"
    components: string // "PascalCase, noun-based"
  }

  // Import conventions
  imports: {
    aliasPattern: string // "@/ for root imports"
    ordering: string[] // ["react", "external", "internal", "relative"]
    preferredStyle: string // "named imports over default"
  }

  // Code style (from linter/prettier config)
  codeStyle: {
    quotes: 'single' | 'double'
    semicolons: boolean
    indentation: string // "2 spaces", "tabs"
    maxLineLength?: number
    trailingCommas: 'none' | 'es5' | 'all'
  }

  // Error handling patterns
  errorHandling: {
    pattern: string // "Custom error classes"
    errorClasses: string[] // ["UnauthorizedError", "NotFoundError"]
    location: string // "lib/errors/"
  }

  // Logging patterns
  logging?: {
    library?: string
    pattern: string
  }

  // Commit message style
  commitStyle: string // "Conventional commits", "Semantic", etc.

  // PR conventions
  prConventions?: {
    titleFormat: string
    bodyTemplate?: string
    requiredSections: string[]
  }

  // Component patterns (for frontend)
  componentPatterns?: {
    stateManagement: string
    stylingApproach: string
    propTypes: string // "TypeScript interfaces", "PropTypes"
  }

  // Important patterns to follow
  mustFollow: string[] // Critical conventions that must not be violated

  // Anti-patterns to avoid
  antiPatterns: string[] // Things this codebase specifically avoids
}

export interface FileIndexEntry {
  path: string
  type: 'file' | 'directory'
  language?: string
  size?: number
  lastModified?: string

  // Semantic categorization
  category:
    | 'component'
    | 'page'
    | 'api-route'
    | 'database'
    | 'query'
    | 'utility'
    | 'config'
    | 'test'
    | 'type'
    | 'style'
    | 'documentation'
    | 'other'

  // Brief purpose (1 sentence)
  purpose?: string

  // Related files
  relatedFiles?: string[]

  // Exports (for modules)
  exports?: string[]
}
```

---

## Agent Specifications

### 1. Architecture Agent

**Model:** Claude 3 Haiku (fast, cost-effective)
**Input:** Repository root, package.json, config files
**Output:** `ArchitectureKnowledge`

```typescript
// lib/autonomous-fix/agents/architecture-agent.ts

const ARCHITECTURE_AGENT_PROMPT = `You are analyzing a codebase to extract its architectural structure.

Examine the following files and provide a structured analysis:
1. package.json / requirements.txt / go.mod (dependencies)
2. Config files (next.config.ts, tsconfig.json, etc.)
3. Top-level directory structure
4. Key entry points

Output a JSON object matching the ArchitectureKnowledge interface.

Focus on:
- Framework and version detection
- Directory purpose mapping
- Key files and their roles
- Build/run commands
- Environment requirements

Be precise and factual. Only report what you can verify from the files.`

export async function runArchitectureAgent(
  repoPath: string,
  files: FileContent[]
): Promise<ArchitectureKnowledge> {
  // Implementation
}
```

### 2. API Routes Agent

**Model:** Claude 3 Haiku
**Input:** Route files, middleware, auth configuration
**Output:** `ApiRoutesKnowledge`

```typescript
const API_ROUTES_AGENT_PROMPT = `You are analyzing API routes in a codebase.

Examine route handlers, middleware, and authentication patterns.

For each endpoint, identify:
- HTTP method and path
- Authentication requirements
- Permission checks
- Request/response shapes
- Related database operations

Output a JSON object matching the ApiRoutesKnowledge interface.

Be thorough - missing an endpoint could cause bugs to be misdiagnosed.`
```

### 3. Schema Agent

**Model:** Claude 3 Haiku
**Input:** Schema files, migrations, model definitions
**Output:** `DatabaseSchemaKnowledge`

```typescript
const SCHEMA_AGENT_PROMPT = `You are analyzing database schema definitions.

Examine:
- ORM schema files (Drizzle, Prisma, TypeORM, etc.)
- Migration files
- Model/entity definitions
- Relation definitions

For each table, identify:
- All columns with types
- Primary and foreign keys
- Indexes
- Relations (one-to-one, one-to-many, many-to-many)
- Soft delete patterns
- Timestamp patterns

Output a JSON object matching the DatabaseSchemaKnowledge interface.

Accuracy is critical - incorrect schema knowledge leads to broken queries.`
```

### 4. Testing Agent

**Model:** Claude 3 Haiku
**Input:** Test files, test configuration, CI configuration
**Output:** `TestingKnowledge`

```typescript
const TESTING_AGENT_PROMPT = `You are analyzing the testing setup of a codebase.

Examine:
- Test configuration files
- Test file patterns and locations
- Test utilities and helpers
- CI/CD configuration for test runs

Identify:
- Test framework(s) in use
- Commands to run tests
- Test file naming conventions
- Source-to-test file mapping
- Common test patterns and utilities

Output a JSON object matching the TestingKnowledge interface.

This information is crucial for validating bug fixes.`
```

### 5. Conventions Agent

**Model:** Claude 3 Haiku
**Input:** Linter config, sample code files, existing PRs (if available)
**Output:** `ConventionsKnowledge`

```typescript
const CONVENTIONS_AGENT_PROMPT = `You are analyzing coding conventions and style patterns.

Examine:
- ESLint/Prettier configuration
- Sample files from different parts of the codebase
- Existing type definitions
- Error handling patterns
- Import patterns

Identify:
- Naming conventions for files, variables, functions, types
- Code style preferences
- Error handling patterns
- Component patterns (if frontend)
- Commit message style (from git log if available)

Output a JSON object matching the ConventionsKnowledge interface.

Fixes must match existing conventions to be accepted.`
```

### 6. Synthesis Agent

**Model:** Claude 3.5 Sonnet (better reasoning for synthesis)
**Input:** Outputs from all other agents
**Output:** Validated combined knowledge + summary

```typescript
const SYNTHESIS_AGENT_PROMPT = `You are synthesizing codebase knowledge from multiple specialist analyses.

You have received analyses from:
- Architecture Agent
- API Routes Agent
- Schema Agent
- Testing Agent
- Conventions Agent

Your tasks:
1. Validate consistency across analyses
2. Resolve any contradictions
3. Fill in gaps where possible
4. Generate a concise summary (~2000 tokens) that captures:
   - What this codebase does
   - Key architectural decisions
   - Most important patterns to follow
   - Critical files and their purposes
   - How to make changes safely

The summary will be used as primary context for bug-fixing agents.
Make it actionable and specific to this codebase.`
```

---

## Incremental Updates

### GitHub Webhook Handler

```typescript
// app/api/webhooks/github/route.ts

export async function POST(req: Request) {
  const event = req.headers.get('x-github-event')
  const payload = await req.json()

  if (event === 'push') {
    await handlePushEvent(payload)
  }
}

async function handlePushEvent(payload: GitHubPushPayload) {
  const { repository, commits, ref } = payload

  // Only process pushes to default branch
  if (ref !== `refs/heads/${repository.default_branch}`) {
    return
  }

  // Find linked repo
  const repoLink = await db.query.githubRepoLinks.findFirst({
    where: eq(githubRepoLinks.repoFullName, repository.full_name)
  })

  if (!repoLink) return

  // Get current knowledge
  const knowledge = await db.query.codebaseKnowledge.findFirst({
    where: eq(codebaseKnowledge.githubRepoLinkId, repoLink.id)
  })

  if (!knowledge) return

  // Collect changed files
  const changedFiles = new Set<string>()
  for (const commit of commits) {
    commit.added.forEach(f => changedFiles.add(f))
    commit.modified.forEach(f => changedFiles.add(f))
    commit.removed.forEach(f => changedFiles.add(f))
  }

  // Determine which agents need to re-run
  const agentsToRerun: string[] = []

  if (matchesPatterns(changedFiles, ['package.json', 'tsconfig.json', '*.config.*'])) {
    agentsToRerun.push('ARCHITECTURE')
  }
  if (matchesPatterns(changedFiles, ['app/api/**', 'pages/api/**', 'routes/**'])) {
    agentsToRerun.push('API')
  }
  if (matchesPatterns(changedFiles, ['**/schema.*', '**/models/**', 'migrations/**', 'prisma/**'])) {
    agentsToRerun.push('SCHEMA')
  }
  if (matchesPatterns(changedFiles, ['**/*.test.*', '**/*.spec.*', 'jest.config.*', 'vitest.config.*'])) {
    agentsToRerun.push('TESTING')
  }
  if (matchesPatterns(changedFiles, ['.eslintrc*', '.prettierrc*', 'tsconfig.json'])) {
    agentsToRerun.push('CONVENTIONS')
  }

  if (agentsToRerun.length > 0) {
    // Queue incremental analysis job
    await queueIncrementalAnalysis(knowledge.id, agentsToRerun, payload.after)
  } else {
    // Just update the commit SHA
    await db.update(codebaseKnowledge)
      .set({ commitSha: payload.after, updatedAt: new Date().toISOString() })
      .where(eq(codebaseKnowledge.id, knowledge.id))
  }
}
```

---

## Integration with Repo Linking

### Modified Repo Linking Flow

```typescript
// lib/data/github-repos/index.ts

export async function linkRepoToProject(
  projectId: string,
  repoData: LinkRepoInput,
  userId: string
): Promise<GithubRepoLink> {
  return await db.transaction(async (tx) => {
    // Create repo link
    const [repoLink] = await tx.insert(githubRepoLinks).values({
      projectId,
      oauthConnectionId: repoData.oauthConnectionId,
      repoOwner: repoData.owner,
      repoName: repoData.name,
      repoFullName: `${repoData.owner}/${repoData.name}`,
      repoId: repoData.id,
      defaultBranch: repoData.defaultBranch,
      linkedBy: userId,
    }).returning()

    // Create pending codebase knowledge record
    await tx.insert(codebaseKnowledge).values({
      githubRepoLinkId: repoLink.id,
      commitSha: 'pending', // Will be updated when analysis starts
      branchName: repoData.defaultBranch,
      status: 'PENDING',
    })

    // Queue analysis job (non-blocking)
    await queueCodebaseAnalysis(repoLink.id)

    return repoLink
  })
}
```

---

## API Endpoints

### GET `/api/codebase-knowledge/:repoLinkId`

Returns current knowledge state for a linked repo.

```typescript
export async function GET(
  req: Request,
  { params }: { params: { repoLinkId: string } }
) {
  const user = await requireUser()

  const knowledge = await db.query.codebaseKnowledge.findFirst({
    where: eq(codebaseKnowledge.githubRepoLinkId, params.repoLinkId)
  })

  if (!knowledge) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, data: knowledge })
}
```

### POST `/api/codebase-knowledge/:repoLinkId/refresh`

Manually trigger a full re-analysis.

```typescript
export async function POST(
  req: Request,
  { params }: { params: { repoLinkId: string } }
) {
  const user = await requireUser()
  await assertAdmin(user)

  await queueCodebaseAnalysis(params.repoLinkId, { force: true })

  return NextResponse.json({ ok: true })
}
```

### GET `/api/codebase-knowledge/:repoLinkId/summary`

Returns just the summary (for quick context loading).

```typescript
export async function GET(
  req: Request,
  { params }: { params: { repoLinkId: string } }
) {
  const knowledge = await db.query.codebaseKnowledge.findFirst({
    where: eq(codebaseKnowledge.githubRepoLinkId, params.repoLinkId),
    columns: { summary: true, status: true, commitSha: true }
  })

  return NextResponse.json({ ok: true, data: knowledge })
}
```

---

## Error Handling

### Analysis Failures

```typescript
async function handleAnalysisError(
  knowledgeId: string,
  error: Error,
  agentType?: string
) {
  const knowledge = await db.query.codebaseKnowledge.findFirst({
    where: eq(codebaseKnowledge.id, knowledgeId)
  })

  const retryCount = (knowledge?.retryCount ?? 0) + 1
  const maxRetries = 3

  if (retryCount < maxRetries) {
    // Retry with exponential backoff
    await db.update(codebaseKnowledge)
      .set({
        retryCount,
        status: 'PENDING',
        errorMessage: `Retry ${retryCount}/${maxRetries}: ${error.message}`
      })
      .where(eq(codebaseKnowledge.id, knowledgeId))

    const delay = Math.pow(2, retryCount) * 1000 // 2s, 4s, 8s
    await scheduleRetry(knowledgeId, delay)
  } else {
    // Mark as failed
    await db.update(codebaseKnowledge)
      .set({
        status: 'FAILED',
        errorMessage: error.message,
        errorStack: error.stack,
      })
      .where(eq(codebaseKnowledge.id, knowledgeId))

    // Alert team
    await sendAlert({
      type: 'CODEBASE_ANALYSIS_FAILED',
      knowledgeId,
      error: error.message,
    })
  }
}
```

---

## Testing Requirements

### Unit Tests
- [ ] Each agent produces valid output matching type definitions
- [ ] Synthesis agent correctly merges agent outputs
- [ ] Webhook handler correctly identifies which agents to re-run
- [ ] Error handling and retry logic works correctly

### Integration Tests
- [ ] Full analysis flow completes for sample repositories
- [ ] Incremental updates work correctly
- [ ] Knowledge is correctly retrieved for bug-fixing

### Sample Repositories for Testing
1. This portal codebase (Next.js + Drizzle)
2. Simple Express API
3. Python Django project
4. React + Vite frontend

---

## Success Criteria

1. **Accuracy:** Knowledge matches manual inspection of codebase (>95%)
2. **Completeness:** All endpoints, tables, and patterns captured
3. **Performance:** Full analysis completes in <5 minutes for typical repo
4. **Cost:** <$0.50 per full analysis (using Haiku for specialists)
5. **Freshness:** Knowledge updated within 5 minutes of push to main

---

## Dependencies

- Existing GitHub OAuth integration (Phase 4.1-4.3 of email integration)
- GitHub API access for cloning and file reading
- Anthropic API for Claude agents
- Job queue system (to be determined)

---

## Files to Create

```
lib/
├── codebase-knowledge/
│   ├── types.ts                 # Type definitions
│   ├── analysis-job.ts          # Job orchestration
│   ├── agents/
│   │   ├── architecture.ts      # Architecture agent
│   │   ├── api-routes.ts        # API routes agent
│   │   ├── schema.ts            # Schema agent
│   │   ├── testing.ts           # Testing agent
│   │   ├── conventions.ts       # Conventions agent
│   │   └── synthesis.ts         # Synthesis agent
│   ├── incremental-update.ts    # Webhook-triggered updates
│   └── index.ts                 # Public exports
├── queries/
│   └── codebase-knowledge.ts    # Database queries
├── data/
│   └── codebase-knowledge/
│       └── index.ts             # Data layer functions
app/
├── api/
│   ├── codebase-knowledge/
│   │   ├── [repoLinkId]/
│   │   │   ├── route.ts         # GET knowledge
│   │   │   ├── refresh/
│   │   │   │   └── route.ts     # POST refresh
│   │   │   └── summary/
│   │   │       └── route.ts     # GET summary only
│   └── webhooks/
│       └── github/
│           └── route.ts         # GitHub webhook handler
drizzle/
└── migrations/
    └── XXXX_codebase_knowledge.sql
```

---

## Next Steps

After Phase 1 is complete:
- Phase 2 will use this knowledge to better understand bug reports
- Phase 4 will load this knowledge into the coordinator agent's context
