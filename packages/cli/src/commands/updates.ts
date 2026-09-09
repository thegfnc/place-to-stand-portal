import { readFileSync } from 'node:fs'

import type { Command } from 'commander'

import { apiGet, apiPost } from '../client.js'
import { resolveApiContext } from '../context.js'
import { emit, emitMessage } from '../output.js'

type DraftOptions = {
  client: string
  since?: string
  subject?: string
  intro?: string
  items?: string
  closing?: string
}

type ListOptions = {
  client?: string
  status?: string
  limit?: string
}

type ClientUpdate = {
  id: string
  path: string
}

type ItemInput = {
  taskId?: string | null
  label: string
  body?: string
}

/**
 * `--items` takes a path or `-` for stdin. The file is a JSON array of
 * `{ taskId?, label, body? }`; body is minimal markdown (bold, italic, links,
 * line breaks). The session that did the work writes this — it is the one
 * thing the portal cannot derive.
 */
function readItems(source: string): ItemInput[] {
  const raw =
    source === '-' ? readFileSync(0, 'utf8') : readFileSync(source, 'utf8')
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error('--items must be a JSON array of { taskId?, label, body? }')
  }
  return parsed as ItemInput[]
}

export function registerUpdateCommands(program: Command): void {
  const updates = program
    .command('updates')
    .description(
      'Client status emails: draft from the CLI, review and send in the portal'
    )

  updates
    .command('draft')
    .description(
      'Create a draft update for a client and print its portal URL. Pass --items with what you did; without it the draft is scaffolded from tasks that moved this window.'
    )
    .requiredOption('--client <ref>', 'Client UUID or slug')
    .option(
      '--items <file>',
      'JSON array of { taskId?, label, body? }; "-" reads stdin'
    )
    .option('--subject <text>', 'Defaults to "<Client> updates"')
    .option('--intro <text>', 'Opening line under the greeting')
    .option('--closing <text>', 'Sign-off line above the footer')
    .option(
      '--since <date>',
      'Scaffold window start as YYYY-MM-DD (defaults to the day after the last sent update, else 7 days ago)'
    )
    .action(async (options: DraftOptions) => {
      const { data, warning } = await apiPost<ClientUpdate>(
        'api/cli/v1/updates',
        {
          client: options.client,
          since: options.since,
          subject: options.subject,
          intro: options.intro,
          items: options.items ? readItems(options.items) : undefined,
          closing: options.closing,
        }
      )

      emit(data, warning)

      // The URL goes to stderr so `pts updates draft | jq` still sees clean JSON.
      const apiUrl = await resolveApiContext()
      emitMessage(`Review and send: ${apiUrl}${data.path}`)
    })

  updates
    .command('list')
    .description('List updates, newest first')
    .option('--client <ref>', 'Client UUID or slug')
    .option('--status <status>', 'DRAFT | SENT')
    .option('--limit <count>', 'Maximum rows (default 50, max 200)')
    .action(async (options: ListOptions) => {
      const { data } = await apiGet('api/cli/v1/updates', {
        client: options.client,
        status: options.status,
        limit: options.limit,
      })

      emit(data)
    })

  updates
    .command('show <updateId>')
    .description('Show one update')
    .action(async (updateId: string) => {
      const { data } = await apiGet(`api/cli/v1/updates/${updateId}`)

      emit(data)
    })
}
