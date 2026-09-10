import { readFileSync } from 'node:fs'

import type { Command } from 'commander'

import { apiGet, apiPatch, apiPost } from '../client.js'
import { resolveApiContext } from '../context.js'
import { emit, emitMessage } from '../output.js'

type Task = {
  id: string
  /** Absent from servers that predate it, so the URL line is best-effort. */
  path?: string | null
}

type ListOptions = {
  project?: string
  status?: string
  assignee?: string
  limit?: string
}

type CreateOptions = {
  title: string
  project: string
  description?: string
  status?: string
  due?: string
  assignee?: string[]
}

type EditOptions = {
  title?: string
  project?: string
  description?: string
  status?: string
  due?: string
  assignee?: string[]
  clearDescription?: boolean
  clearDue?: boolean
}

/**
 * Multi-paragraph text is awkward to pass as one shell argument, so every
 * free-text flag (`--body`, `--description`) accepts `-` to read stdin — a
 * heredoc, usually — like `updates draft --items -`.
 */
function textOrStdin(value: string | undefined): string | undefined {
  return value === '-' ? readFileSync(0, 'utf8') : value
}

/**
 * The portal URL goes to stderr, as `updates draft` does, so
 * `pts tasks create | jq` still sees clean JSON on stdout.
 */
async function emitTaskUrl(task: Task): Promise<void> {
  if (!task.path) {
    return
  }

  const apiUrl = await resolveApiContext()
  emitMessage(`View: ${apiUrl}${task.path}`)
}

export function registerTaskCommands(program: Command): void {
  const tasks = program.command('tasks').description('Read and write tasks')

  tasks
    .command('list')
    .description('List tasks, most recently updated first')
    .option('--project <ref>', 'Project UUID or slug')
    .option('--status <status>', 'ON_DECK | IN_PROGRESS | BLOCKED | DONE')
    .option('--assignee <userId>', 'Only tasks assigned to this user id')
    .option('--limit <count>', 'Maximum rows (default 50, max 200)')
    .action(async (options: ListOptions) => {
      const { data } = await apiGet('api/cli/v1/tasks', {
        project: options.project,
        status: options.status,
        assignee: options.assignee,
        limit: options.limit,
      })

      emit(data)
    })

  tasks
    .command('show <taskId>')
    .description('Show one task')
    .action(async (taskId: string) => {
      const { data } = await apiGet<Task>(`api/cli/v1/tasks/${taskId}`)

      emit(data)
      await emitTaskUrl(data)
    })

  tasks
    .command('create')
    .description('Create a task')
    .requiredOption('--title <title>', 'Task title')
    .requiredOption('--project <ref>', 'Project UUID or slug')
    .option('--description <text>', 'Task description; "-" reads stdin')
    .option('--status <status>', 'Defaults to ON_DECK')
    .option('--due <date>', 'Due date as YYYY-MM-DD')
    .option('--assignee <user...>', 'Assign by email or user id')
    .action(async (options: CreateOptions) => {
      const { data, warning } = await apiPost<Task>('api/cli/v1/tasks', {
        title: options.title,
        project: options.project,
        description: textOrStdin(options.description),
        status: options.status,
        dueOn: options.due,
        assigneeIds: options.assignee,
      })

      emit(data, warning)
      await emitTaskUrl(data)
    })

  tasks
    .command('comment <taskId>')
    .description(
      'Add a comment to a task. The body is minimal markdown: paragraphs on blank lines, - bullets, 1. numbered lists, **bold**, *italic*, `code`, [text](https://…) links.'
    )
    .requiredOption('--body <text>', 'Comment body; "-" reads stdin')
    .action(async (taskId: string, options: { body: string }) => {
      const body = textOrStdin(options.body)

      const { data } = await apiPost(`api/cli/v1/tasks/${taskId}/comments`, {
        body,
      })

      emit(data)
    })

  tasks
    .command('comments <taskId>')
    .description('List comments on a task')
    .option('--limit <count>', 'Maximum rows (default 50, max 100)')
    .action(async (taskId: string, options: { limit?: string }) => {
      const { data } = await apiGet(`api/cli/v1/tasks/${taskId}/comments`, {
        limit: options.limit,
      })

      emit(data)
    })

  tasks
    .command('edit <taskId>')
    .description('Update a task; omitted fields keep their current values')
    .option('--title <title>')
    .option('--project <ref>', 'Move the task to another project')
    .option('--description <text>', 'Task description; "-" reads stdin')
    .option('--status <status>')
    .option('--due <date>', 'Due date as YYYY-MM-DD')
    .option('--assignee <user...>', 'Replace assignees, by email or user id')
    .option('--clear-description', 'Remove the description')
    .option('--clear-due', 'Remove the due date')
    .action(async (taskId: string, options: EditOptions) => {
      // Only keys actually present are sent. The API treats an absent key as
      // "leave alone" and an explicit null as "clear", which is what the
      // --clear-* flags produce.
      const payload: Record<string, unknown> = {}

      if (options.title !== undefined) payload.title = options.title
      if (options.project !== undefined) payload.project = options.project
      if (options.status !== undefined) payload.status = options.status
      if (options.assignee !== undefined) payload.assigneeIds = options.assignee

      if (options.clearDescription) {
        payload.description = null
      } else if (options.description !== undefined) {
        payload.description = textOrStdin(options.description)
      }

      if (options.clearDue) {
        payload.dueOn = null
      } else if (options.due !== undefined) {
        payload.dueOn = options.due
      }

      if (!Object.keys(payload).length) {
        throw new Error('Provide at least one field to update.')
      }

      const { data, warning } = await apiPatch<Task>(
        `api/cli/v1/tasks/${taskId}`,
        payload
      )

      emit(data, warning)
      await emitTaskUrl(data)
    })
}
