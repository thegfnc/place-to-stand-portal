# Phase 4: Claude Agent Orchestration

**Status:** Planning
**Priority:** Critical (Core intelligence)
**Estimated Effort:** 3-4 weeks
**Dependencies:** Phase 1 (Codebase Intelligence), Phase 3 (Execution Environment)

---

## Overview

This phase implements the multi-agent system that analyzes bugs and implements fixes. A Coordinator Agent (Claude Opus) orchestrates specialist agents (Claude Haiku) that work in parallel to understand different aspects of the problem before the Coordinator synthesizes findings and implements the fix.

---

## Goals

1. **Autonomous reasoning** - Claude understands bugs and designs fixes without human guidance
2. **Efficient analysis** - Parallel specialist agents reduce time and improve coverage
3. **Quality fixes** - Fixes follow codebase conventions and don't introduce regressions
4. **Cost control** - Token budgets and model selection optimize costs
5. **Transparency** - Full logging of agent reasoning for debugging and improvement

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        COORDINATOR AGENT (Claude Opus)                           │
│                                                                                  │
│  Responsibilities:                                                               │
│  1. Understand bug report and codebase knowledge                                 │
│  2. Design investigation strategy                                                │
│  3. Delegate to specialist agents                                                │
│  4. Synthesize findings                                                          │
│  5. Design solution                                                              │
│  6. Implement fix                                                                │
│  7. Verify fix                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
         │                    │                    │                    │
         │ spawn              │ spawn              │ spawn              │ spawn
         ▼                    ▼                    ▼                    ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  CODEBASE   │       │   SCHEMA    │       │    TEST     │       │   REVIEW    │
│   AGENT     │       │   AGENT     │       │   AGENT     │       │   AGENT     │
│  (Haiku)    │       │  (Haiku)    │       │  (Haiku)    │       │  (Haiku)    │
│             │       │             │       │             │       │             │
│ Find files  │       │ Check DB    │       │ Find tests  │       │ Review fix  │
│ Trace code  │       │ impact      │       │ Suggest     │       │ Check edge  │
│ Find refs   │       │ Migrations  │       │ new tests   │       │ cases       │
└─────────────┘       └─────────────┘       └─────────────┘       └─────────────┘
         │                    │                    │                    │
         └────────────────────┴────────────────────┴────────────────────┘
                                        │
                                        ▼
                              Back to Coordinator
                              for synthesis and
                              implementation
```

---

## Tool Definitions

### File System Tools

```typescript
// lib/agents/tools/filesystem.ts

export const fileSystemTools: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: `Read the contents of a file in the repository.
Returns the file contents as a string.
Use this to understand existing code before making changes.`,
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file relative to repository root (e.g., "lib/auth/session.ts")'
        },
        start_line: {
          type: 'number',
          description: 'Optional: Start reading from this line number (1-indexed)'
        },
        end_line: {
          type: 'number',
          description: 'Optional: Stop reading at this line number (inclusive)'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: `Write or overwrite a file in the repository.
Use this to implement fixes. Always read the file first to understand existing content.
Preserve existing style, indentation, and conventions.`,
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file relative to repository root'
        },
        content: {
          type: 'string',
          description: 'The complete new content for the file'
        }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'edit_file',
    description: `Make a targeted edit to a file by replacing specific content.
More precise than write_file for small changes.
The old_content must match exactly (including whitespace).`,
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file'
        },
        old_content: {
          type: 'string',
          description: 'The exact content to replace (must match exactly)'
        },
        new_content: {
          type: 'string',
          description: 'The new content to insert'
        }
      },
      required: ['path', 'old_content', 'new_content']
    }
  },
  {
    name: 'list_directory',
    description: `List files and directories at a path.
Use to explore the repository structure.`,
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path relative to repository root'
        },
        recursive: {
          type: 'boolean',
          description: 'If true, list all files recursively (default: false)'
        },
        pattern: {
          type: 'string',
          description: 'Optional glob pattern to filter results (e.g., "*.ts")'
        }
      },
      required: ['path']
    }
  }
]
```

### Search Tools

```typescript
// lib/agents/tools/search.ts

export const searchTools: Anthropic.Tool[] = [
  {
    name: 'search_code',
    description: `Search for patterns in the codebase using regex.
Returns matching lines with file paths and line numbers.
Use to find usages, definitions, or patterns.`,
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regex pattern to search for'
        },
        file_pattern: {
          type: 'string',
          description: 'Optional glob pattern to filter files (e.g., "**/*.ts")'
        },
        context_lines: {
          type: 'number',
          description: 'Number of context lines before and after match (default: 2)'
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (default: 50)'
        }
      },
      required: ['pattern']
    }
  },
  {
    name: 'find_definition',
    description: `Find the definition of a function, class, or variable.
Returns the file path and line number of the definition.`,
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the function, class, or variable to find'
        },
        type: {
          type: 'string',
          enum: ['function', 'class', 'variable', 'type', 'any'],
          description: 'Type of definition to find (default: any)'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'find_references',
    description: `Find all references to a function, class, or variable.
Returns all locations where the symbol is used.`,
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the symbol to find references for'
        },
        file_pattern: {
          type: 'string',
          description: 'Optional glob pattern to limit search scope'
        }
      },
      required: ['name']
    }
  }
]
```

### Execution Tools

```typescript
// lib/agents/tools/execution.ts

export const executionTools: Anthropic.Tool[] = [
  {
    name: 'run_command',
    description: `Run a shell command in the repository directory.
Use for running tests, linting, type checking, etc.
Commands are executed with a 5-minute timeout.`,
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to run'
        },
        cwd: {
          type: 'string',
          description: 'Optional: Working directory relative to repo root'
        },
        timeout_ms: {
          type: 'number',
          description: 'Optional: Timeout in milliseconds (default: 300000 = 5 min)'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'run_tests',
    description: `Run the test suite or specific tests.
Returns test results with pass/fail status.`,
    input_schema: {
      type: 'object',
      properties: {
        test_path: {
          type: 'string',
          description: 'Optional: Specific test file or pattern to run'
        },
        coverage: {
          type: 'boolean',
          description: 'Whether to collect coverage (default: false)'
        }
      }
    }
  }
]
```

### Git Tools

```typescript
// lib/agents/tools/git.ts

export const gitTools: Anthropic.Tool[] = [
  {
    name: 'git_status',
    description: `Get the current git status showing modified, staged, and untracked files.`,
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'git_diff',
    description: `Get the diff of changes in the repository.`,
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Optional: Specific file path to diff'
        },
        staged: {
          type: 'boolean',
          description: 'Show staged changes only (default: false, shows unstaged)'
        }
      }
    }
  },
  {
    name: 'git_log',
    description: `Get recent commit history.`,
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Optional: Show history for specific file'
        },
        limit: {
          type: 'number',
          description: 'Number of commits to show (default: 10)'
        }
      }
    }
  },
  {
    name: 'create_branch',
    description: `Create a new git branch for the fix.`,
    input_schema: {
      type: 'object',
      properties: {
        branch_name: {
          type: 'string',
          description: 'Name for the new branch (e.g., "fix/login-validation-error")'
        }
      },
      required: ['branch_name']
    }
  },
  {
    name: 'stage_changes',
    description: `Stage files for commit.`,
    input_schema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'File paths to stage. Use ["."] to stage all changes.'
        }
      },
      required: ['paths']
    }
  },
  {
    name: 'create_commit',
    description: `Create a commit with staged changes.`,
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Commit message following conventional commits format'
        }
      },
      required: ['message']
    }
  }
]
```

### Agent Delegation Tools

```typescript
// lib/agents/tools/delegation.ts

export const delegationTools: Anthropic.Tool[] = [
  {
    name: 'spawn_codebase_agent',
    description: `Spawn a specialist agent to analyze the codebase structure.
The agent will return insights about file organization, patterns, and relevant code locations.
Use when you need to understand how code flows or find related files.`,
    input_schema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Specific task for the agent (e.g., "Find all files that handle user authentication")'
        },
        focus_areas: {
          type: 'array',
          items: { type: 'string' },
          description: 'Directories or files to focus on'
        }
      },
      required: ['task']
    }
  },
  {
    name: 'spawn_schema_agent',
    description: `Spawn a specialist agent to analyze database schema impact.
The agent will analyze if the bug/fix involves database changes and what migrations might be needed.`,
    input_schema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Specific task (e.g., "Check if the users table needs a new column")'
        },
        tables: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific tables to analyze'
        }
      },
      required: ['task']
    }
  },
  {
    name: 'spawn_test_agent',
    description: `Spawn a specialist agent to analyze testing requirements.
The agent will find relevant existing tests and suggest what new tests are needed.`,
    input_schema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Specific task (e.g., "Find tests for the login flow and suggest new tests for the fix")'
        },
        files_changed: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files being modified that need test coverage'
        }
      },
      required: ['task']
    }
  },
  {
    name: 'spawn_review_agent',
    description: `Spawn a specialist agent to review the fix before committing.
The agent will check for potential issues, edge cases, and code quality.`,
    input_schema: {
      type: 'object',
      properties: {
        changes: {
          type: 'string',
          description: 'Description of the changes made'
        },
        files_changed: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of files that were modified'
        }
      },
      required: ['changes', 'files_changed']
    }
  }
]
```

---

## Coordinator Agent

### System Prompt

```typescript
// lib/agents/coordinator/prompt.ts

export function buildCoordinatorPrompt(
  bugReport: BugReport,
  codebaseKnowledge: CodebaseKnowledge
): string {
  return `You are an autonomous bug-fixing agent. Your job is to analyze a bug report, understand the codebase, implement a fix, and create a commit.

## CODEBASE KNOWLEDGE

This repository has been pre-analyzed. Here's what you need to know:

### Summary
${codebaseKnowledge.summary}

### Architecture
${JSON.stringify(codebaseKnowledge.architecture, null, 2)}

### API Routes
${JSON.stringify(codebaseKnowledge.apiRoutes, null, 2)}

### Database Schema
${JSON.stringify(codebaseKnowledge.databaseSchema, null, 2)}

### Testing
${JSON.stringify(codebaseKnowledge.testingInfo, null, 2)}

### Conventions
${JSON.stringify(codebaseKnowledge.conventions, null, 2)}

---

## BUG REPORT

**Title:** ${bugReport.title}

**Description:**
${bugReport.description}

**Steps to Reproduce:**
${bugReport.stepsToReproduce || 'Not provided'}

**Expected Behavior:**
${bugReport.expectedBehavior || 'Not provided'}

**Actual Behavior:**
${bugReport.actualBehavior || 'Not provided'}

**Error Message:**
${bugReport.errorMessage || 'Not provided'}

**Stack Trace:**
\`\`\`
${bugReport.stackTrace || 'Not provided'}
\`\`\`

**Affected URL/Feature:**
${bugReport.affectedUrl || bugReport.affectedFeature || 'Not specified'}

**Severity:** ${bugReport.severity}

---

## YOUR TASK

1. **Analyze** - Understand the bug and identify the root cause
2. **Investigate** - Use specialist agents to explore the codebase in parallel
3. **Design** - Plan the fix, considering edge cases and side effects
4. **Implement** - Make the necessary code changes
5. **Verify** - Run tests to ensure the fix works and doesn't break anything
6. **Commit** - Create a branch and commit with a clear message

## IMPORTANT GUIDELINES

1. **Follow existing patterns** - Match the codebase's style, conventions, and patterns exactly
2. **Minimal changes** - Only change what's necessary to fix the bug
3. **No scope creep** - Don't refactor, optimize, or add features beyond the fix
4. **Test coverage** - Ensure tests pass; add tests if the area lacks coverage
5. **Conventional commits** - Use format: "fix(scope): description"
6. **Safety first** - If unsure about a change's impact, investigate more

## SPECIALIST AGENTS

You can spawn these agents to help with investigation (they run in parallel):
- **codebase_agent** - Find files, trace code paths, understand structure
- **schema_agent** - Analyze database impact, check for migration needs
- **test_agent** - Find relevant tests, suggest new test cases
- **review_agent** - Review your fix for issues before committing

Spawn multiple agents at once when their tasks are independent.

## OUTPUT

After implementing the fix:
1. Create a branch named "fix/[short-description]"
2. Commit with a conventional commit message
3. Provide a summary of:
   - Root cause analysis
   - What was changed and why
   - How the fix was verified

Begin by analyzing the bug report and designing your investigation strategy.`
}
```

### Coordinator Implementation

```typescript
// lib/agents/coordinator/index.ts

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export interface CoordinatorResult {
  success: boolean
  rootCauseAnalysis: string
  proposedSolution: string
  filesChanged: string[]
  commitMessage: string
  branchName: string
  testResults: {
    passed: boolean
    summary: string
  }
  reviewNotes: string
  tokensUsed: {
    prompt: number
    completion: number
    total: number
  }
}

export async function runCoordinatorAgent(
  job: AutonomousFixJob,
  bugReport: BugReport,
  codebaseKnowledge: CodebaseKnowledge,
  toolExecutor: ToolExecutor
): Promise<CoordinatorResult> {

  const systemPrompt = buildCoordinatorPrompt(bugReport, codebaseKnowledge)

  const allTools = [
    ...fileSystemTools,
    ...searchTools,
    ...executionTools,
    ...gitTools,
    ...delegationTools,
  ]

  let messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: 'Analyze this bug and implement a fix. Begin with your investigation strategy.'
    }
  ]

  let totalPromptTokens = 0
  let totalCompletionTokens = 0
  let iteration = 0
  const maxIterations = 50 // Safety limit

  while (iteration < maxIterations) {
    iteration++

    // Check token budget
    if (totalPromptTokens + totalCompletionTokens > JOB_LIMITS.maxTotalTokens) {
      throw new TokenLimitError('Token budget exceeded')
    }

    // Check time limit
    checkLimits(job)

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 16000,
      system: systemPrompt,
      tools: allTools,
      messages,
    })

    totalPromptTokens += response.usage.input_tokens
    totalCompletionTokens += response.usage.output_tokens

    // Log agent response
    await logAgentStep(job.id, 'COORDINATOR', iteration, response)

    // Update job with token usage
    await updateJobTokens(job.id, totalPromptTokens, totalCompletionTokens)

    // Check stop reason
    if (response.stop_reason === 'end_turn') {
      // Agent is done - extract final summary
      const textContent = response.content.find(c => c.type === 'text')
      return parseCoordinatorOutput(textContent?.text ?? '', job)
    }

    if (response.stop_reason === 'tool_use') {
      // Execute tools
      const toolUses = response.content.filter(c => c.type === 'tool_use')

      // Handle parallel tool calls
      const toolResults = await Promise.all(
        toolUses.map(async (toolUse) => {
          if (toolUse.type !== 'tool_use') return null

          const result = await executeToolWithLogging(
            job.id,
            toolUse.name,
            toolUse.input,
            toolExecutor
          )

          return {
            type: 'tool_result' as const,
            tool_use_id: toolUse.id,
            content: result,
          }
        })
      )

      // Add assistant response and tool results to messages
      messages.push({ role: 'assistant', content: response.content })
      messages.push({
        role: 'user',
        content: toolResults.filter(Boolean) as Anthropic.ToolResultBlockParam[]
      })
    }
  }

  throw new Error('Coordinator exceeded maximum iterations')
}
```

---

## Specialist Agents

### Codebase Agent

```typescript
// lib/agents/specialists/codebase.ts

const CODEBASE_AGENT_PROMPT = `You are a codebase analysis specialist. Your job is to help find and understand code relevant to a bug fix.

You have access to:
- read_file: Read file contents
- list_directory: Explore directory structure
- search_code: Search for patterns
- find_definition: Find where something is defined
- find_references: Find where something is used

Provide clear, actionable insights about:
1. Relevant files and their purposes
2. Code flow and dependencies
3. Related functions/components
4. Potential impact areas

Be thorough but focused on the specific task given.`

export async function runCodebaseAgent(
  task: string,
  focusAreas: string[],
  toolExecutor: ToolExecutor
): Promise<string> {
  const tools = [
    ...fileSystemTools,
    ...searchTools,
  ]

  // Run with Haiku for speed/cost
  const response = await runAgentLoop({
    model: 'claude-3-5-haiku-20241022',
    systemPrompt: CODEBASE_AGENT_PROMPT,
    userMessage: `Task: ${task}\n\nFocus areas: ${focusAreas.join(', ')}`,
    tools,
    toolExecutor,
    maxIterations: 15,
    maxTokens: 4000,
  })

  return response.finalOutput
}
```

### Schema Agent

```typescript
// lib/agents/specialists/schema.ts

const SCHEMA_AGENT_PROMPT = `You are a database schema analysis specialist. Your job is to analyze database impact for bug fixes.

You have access to:
- read_file: Read schema files and migrations
- list_directory: Find migration files
- search_code: Find database queries

Provide insights about:
1. Relevant tables and their relationships
2. Whether schema changes are needed
3. Migration requirements
4. Query patterns that might be affected

Be precise about schema impact - incorrect analysis leads to broken migrations.`

export async function runSchemaAgent(
  task: string,
  tables: string[],
  toolExecutor: ToolExecutor
): Promise<string> {
  // Implementation similar to codebase agent
}
```

### Test Agent

```typescript
// lib/agents/specialists/test.ts

const TEST_AGENT_PROMPT = `You are a testing specialist. Your job is to find relevant tests and suggest test coverage for bug fixes.

You have access to:
- read_file: Read test files
- list_directory: Find test files
- search_code: Find test patterns
- run_tests: Execute specific tests

Provide insights about:
1. Existing tests that cover the affected area
2. Tests that should pass after the fix
3. New tests needed to prevent regression
4. Test commands to run

Be thorough - missing test coverage leads to regressions.`

export async function runTestAgent(
  task: string,
  filesChanged: string[],
  toolExecutor: ToolExecutor
): Promise<string> {
  // Implementation similar to codebase agent
}
```

### Review Agent

```typescript
// lib/agents/specialists/review.ts

const REVIEW_AGENT_PROMPT = `You are a code review specialist. Your job is to review fixes before they are committed.

You have access to:
- read_file: Read changed files
- git_diff: See the changes
- search_code: Find related code

Check for:
1. Logic errors or bugs introduced
2. Edge cases not handled
3. Security issues
4. Performance concerns
5. Convention violations
6. Missing error handling

Be critical but constructive. Flag issues that should block the commit.`

export async function runReviewAgent(
  changes: string,
  filesChanged: string[],
  toolExecutor: ToolExecutor
): Promise<string> {
  // Implementation similar to codebase agent
}
```

---

## Tool Execution

### Tool Executor

```typescript
// lib/agents/tool-executor.ts

export interface ToolExecutor {
  execute(toolName: string, input: Record<string, unknown>): Promise<string>
}

export class ContainerToolExecutor implements ToolExecutor {
  constructor(
    private containerId: string,
    private workspacePath: string
  ) {}

  async execute(toolName: string, input: Record<string, unknown>): Promise<string> {
    switch (toolName) {
      case 'read_file':
        return this.readFile(input.path as string, input.start_line as number, input.end_line as number)

      case 'write_file':
        return this.writeFile(input.path as string, input.content as string)

      case 'edit_file':
        return this.editFile(input.path as string, input.old_content as string, input.new_content as string)

      case 'list_directory':
        return this.listDirectory(input.path as string, input.recursive as boolean, input.pattern as string)

      case 'search_code':
        return this.searchCode(input.pattern as string, input.file_pattern as string, input.context_lines as number)

      case 'run_command':
        return this.runCommand(input.command as string, input.cwd as string, input.timeout_ms as number)

      case 'run_tests':
        return this.runTests(input.test_path as string, input.coverage as boolean)

      case 'git_status':
        return this.runCommand('git status', undefined, 30000)

      case 'git_diff':
        const diffCmd = input.staged ? 'git diff --staged' : 'git diff'
        return this.runCommand(input.path ? `${diffCmd} ${input.path}` : diffCmd, undefined, 30000)

      case 'create_branch':
        return this.runCommand(`git checkout -b ${input.branch_name}`, undefined, 30000)

      case 'stage_changes':
        const paths = (input.paths as string[]).join(' ')
        return this.runCommand(`git add ${paths}`, undefined, 30000)

      case 'create_commit':
        return this.runCommand(`git commit -m "${escapeShell(input.message as string)}"`, undefined, 30000)

      case 'spawn_codebase_agent':
        return runCodebaseAgent(input.task as string, input.focus_areas as string[], this)

      case 'spawn_schema_agent':
        return runSchemaAgent(input.task as string, input.tables as string[], this)

      case 'spawn_test_agent':
        return runTestAgent(input.task as string, input.files_changed as string[], this)

      case 'spawn_review_agent':
        return runReviewAgent(input.changes as string, input.files_changed as string[], this)

      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }

  private async readFile(path: string, startLine?: number, endLine?: number): Promise<string> {
    const fullPath = `${this.workspacePath}/${path}`

    const result = await this.containerExec(['cat', fullPath])

    if (startLine || endLine) {
      const lines = result.split('\n')
      const start = (startLine ?? 1) - 1
      const end = endLine ?? lines.length
      return lines.slice(start, end).join('\n')
    }

    return result
  }

  private async writeFile(path: string, content: string): Promise<string> {
    const fullPath = `${this.workspacePath}/${path}`

    // Ensure directory exists
    const dir = fullPath.split('/').slice(0, -1).join('/')
    await this.containerExec(['mkdir', '-p', dir])

    // Write file using cat with heredoc
    await this.containerExec(['sh', '-c', `cat > ${fullPath} << 'EOFMARKER'\n${content}\nEOFMARKER`])

    return `File written: ${path}`
  }

  private async runCommand(command: string, cwd?: string, timeoutMs?: number): Promise<string> {
    const workDir = cwd ? `${this.workspacePath}/${cwd}` : this.workspacePath

    return this.containerExec(['sh', '-c', command], { cwd: workDir, timeout: timeoutMs })
  }

  private async containerExec(
    cmd: string[],
    options?: { cwd?: string; timeout?: number }
  ): Promise<string> {
    const container = docker.getContainer(this.containerId)

    const exec = await container.exec({
      Cmd: cmd,
      WorkingDir: options?.cwd ?? this.workspacePath,
      AttachStdout: true,
      AttachStderr: true,
    })

    const stream = await exec.start({ Detach: false })
    const output = await streamToString(stream, options?.timeout ?? 300000)

    return output
  }
}
```

---

## Agent Logging

### Execution Logs

```typescript
// lib/agents/logging.ts

export async function logAgentStep(
  jobId: string,
  agentType: string,
  iteration: number,
  response: Anthropic.Message
) {
  await db.insert(agentExecutionLogs).values({
    fixJobId: jobId,
    agentType,
    agentModel: response.model,
    prompt: '', // Could store if needed for debugging
    response: JSON.stringify(response.content),
    toolCalls: response.content
      .filter(c => c.type === 'tool_use')
      .map(c => ({ name: (c as Anthropic.ToolUseBlock).name, input: (c as Anthropic.ToolUseBlock).input })),
    tokensIn: response.usage.input_tokens,
    tokensOut: response.usage.output_tokens,
    status: 'SUCCESS',
    createdAt: new Date().toISOString(),
  })
}

export async function executeToolWithLogging(
  jobId: string,
  toolName: string,
  input: Record<string, unknown>,
  executor: ToolExecutor
): Promise<string> {
  const startTime = Date.now()

  try {
    const result = await executor.execute(toolName, input)

    await db.insert(jobExecutionSteps).values({
      fixJobId: jobId,
      stepName: `tool:${toolName}`,
      stepOrder: await getNextStepOrder(jobId),
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: 'SUCCESS',
      output: result.slice(0, 10000), // Limit stored output
      metadata: { input },
    })

    return result

  } catch (error) {
    await db.insert(jobExecutionSteps).values({
      fixJobId: jobId,
      stepName: `tool:${toolName}`,
      stepOrder: await getNextStepOrder(jobId),
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: 'FAILED',
      errorMessage: (error as Error).message,
      metadata: { input },
    })

    throw error
  }
}
```

---

## Error Handling

### Recoverable Errors

```typescript
// lib/agents/error-handling.ts

export class RecoverableError extends Error {
  constructor(message: string, public retryable: boolean = true) {
    super(message)
    this.name = 'RecoverableError'
  }
}

export async function handleAgentError(
  job: AutonomousFixJob,
  error: Error,
  coordinator: CoordinatorState
): Promise<'retry' | 'fail' | 'escalate'> {

  // Token/budget errors - cannot retry
  if (error instanceof TokenLimitError) {
    await failJob(job.id, error, 'Token limit exceeded')
    return 'fail'
  }

  // Timeout - might be temporary
  if (error instanceof TimeoutError && job.retryCount < job.maxRetries) {
    await scheduleRetry(job.id)
    return 'retry'
  }

  // API errors - might be temporary
  if (error.message.includes('rate_limit') && job.retryCount < job.maxRetries) {
    await scheduleRetry(job.id, 60000) // Wait 1 minute
    return 'retry'
  }

  // Test failures after fix - agent couldn't fix properly
  if (error.message.includes('tests still failing')) {
    // Try with more context
    if (job.retryCount < job.maxRetries) {
      await scheduleRetryWithMoreContext(job.id, error.message)
      return 'retry'
    } else {
      await escalateToHuman(job.id, 'Agent could not fix tests after multiple attempts')
      return 'escalate'
    }
  }

  // Unknown errors
  if (job.retryCount < job.maxRetries) {
    await scheduleRetry(job.id)
    return 'retry'
  }

  await failJob(job.id, error)
  return 'fail'
}
```

---

## Token Budget Management

```typescript
// lib/agents/budget.ts

export interface TokenBudget {
  maxTotal: number
  maxPrompt: number
  maxCompletion: number

  usedTotal: number
  usedPrompt: number
  usedCompletion: number
}

export function createBudget(): TokenBudget {
  return {
    maxTotal: JOB_LIMITS.maxTotalTokens,
    maxPrompt: JOB_LIMITS.maxPromptTokens,
    maxCompletion: JOB_LIMITS.maxCompletionTokens,
    usedTotal: 0,
    usedPrompt: 0,
    usedCompletion: 0,
  }
}

export function checkBudget(budget: TokenBudget): void {
  if (budget.usedTotal > budget.maxTotal) {
    throw new TokenLimitError(`Token budget exceeded: ${budget.usedTotal}/${budget.maxTotal}`)
  }
}

export function updateBudget(
  budget: TokenBudget,
  promptTokens: number,
  completionTokens: number
): TokenBudget {
  return {
    ...budget,
    usedPrompt: budget.usedPrompt + promptTokens,
    usedCompletion: budget.usedCompletion + completionTokens,
    usedTotal: budget.usedTotal + promptTokens + completionTokens,
  }
}

export function estimateCost(budget: TokenBudget): number {
  // Opus pricing (as of Jan 2025)
  const promptCostPer1M = 15 // $15 per 1M input tokens
  const completionCostPer1M = 75 // $75 per 1M output tokens

  const promptCost = (budget.usedPrompt / 1_000_000) * promptCostPer1M
  const completionCost = (budget.usedCompletion / 1_000_000) * completionCostPer1M

  return promptCost + completionCost
}
```

---

## Testing Requirements

### Unit Tests
- [ ] Tool execution functions work correctly
- [ ] Agent prompts produce valid outputs
- [ ] Token budget tracking is accurate
- [ ] Error handling routes correctly

### Integration Tests
- [ ] Coordinator can complete simple fixes
- [ ] Specialist agents return useful information
- [ ] Tool executor works in container environment
- [ ] Full agent loop completes without hanging

### Mock Tests
- [ ] Test with mocked Anthropic API
- [ ] Test with mocked file system
- [ ] Test error recovery scenarios

---

## Success Criteria

1. **Fix Success Rate:** >60% of bugs successfully fixed
2. **Token Efficiency:** Average <100K tokens per fix
3. **Specialist Value:** Specialist agents improve fix quality measurably
4. **Latency:** Average fix time <15 minutes
5. **Cost:** Average <$5 per fix

---

## Files to Create

```
lib/
├── agents/
│   ├── types.ts
│   ├── tools/
│   │   ├── filesystem.ts
│   │   ├── search.ts
│   │   ├── execution.ts
│   │   ├── git.ts
│   │   ├── delegation.ts
│   │   └── index.ts
│   ├── coordinator/
│   │   ├── prompt.ts
│   │   ├── index.ts
│   │   └── parser.ts
│   ├── specialists/
│   │   ├── codebase.ts
│   │   ├── schema.ts
│   │   ├── test.ts
│   │   └── review.ts
│   ├── tool-executor.ts
│   ├── budget.ts
│   ├── logging.ts
│   ├── error-handling.ts
│   └── index.ts
```
