import { Command } from 'commander'

import { ApiError } from './api.js'
import { registerAuthCommands } from './commands/auth.js'
import { registerConfigCommands } from './commands/config.js'
import { registerResourceCommands } from './commands/resources.js'
import { registerTaskCommands } from './commands/tasks.js'
import { registerUpdateCommands } from './commands/updates.js'
import { setGlobalOptions, type GlobalOptions } from './context.js'

const program = new Command()

program
  .name('pts')
  .description(
    'Admin CLI for the Place to Stand portal. Outputs JSON on stdout so it can be piped.'
  )
  .version('0.1.0')
  .option(
    '--api-url <url>',
    'Portal URL (defaults to $PTS_API_URL, then ~/.pts/config.json, then production)'
  )
  .option('--local', 'Target the local dev portal (http://localhost:3000)')
  .option('--prod', 'Target the production portal')
  .option('--pretty', 'Render a table instead of JSON')
  // Global options are read once here so command bodies do not each have to
  // walk up to the root command for them.
  .hook('preAction', thisCommand => {
    setGlobalOptions(thisCommand.opts<GlobalOptions>())
  })

registerAuthCommands(program)
registerConfigCommands(program)
registerTaskCommands(program)
registerUpdateCommands(program)
registerResourceCommands(program)

async function main(): Promise<void> {
  await program.parseAsync(process.argv)
}

// Wrapped rather than awaited at the top level: an unsettled top-level await
// makes Node report its own diagnostic instead of the actual failure.
try {
  await main()
} catch (error) {
  if (error instanceof ApiError) {
    process.stderr.write(`error: ${error.message}\n`)

    if (error.details) {
      process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`)
    }
  } else {
    process.stderr.write(
      `error: ${error instanceof Error ? error.message : String(error)}\n`
    )
  }

  process.exit(1)
}
