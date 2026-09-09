'use client'

import { Plus } from 'lucide-react'

import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'

type CommandCreateRowsProps = {
  /** Current search text of the owning `CommandInput` (controlled). */
  query: string
  /** Singular noun for the copy: "contact" → "Create new contact…". */
  entityLabel: string
  /** Fires with the typed query (possibly empty) as a name prefill. */
  onCreate: (query: string) => void
  /** Copy for the no-match state when creation is not the answer. */
  emptyMessage?: string
}

/**
 * The "create from inside a picker" affordance, shared by every entity
 * picker that supports it: a pinned "Create new …" row at the bottom of the
 * list while browsing, and — once the typed name has no match — a single
 * "Create <entity> “name”" row in the empty state carrying the name as the
 * prefill. Render inside a `CommandList`, after the entity group.
 */
export function CommandCreateRows({
  query,
  entityLabel,
  onCreate,
}: CommandCreateRowsProps) {
  const trimmed = query.trim()

  return (
    <>
      <CommandEmpty className='p-1'>
        <button
          type='button'
          onClick={() => onCreate(trimmed)}
          className='hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm'
        >
          <Plus className='text-muted-foreground size-4 shrink-0' />
          <span className='truncate'>
            Create {entityLabel}{' '}
            <span className='font-medium'>&ldquo;{trimmed}&rdquo;</span>
          </span>
        </button>
      </CommandEmpty>
      {trimmed ? null : (
        <>
          <CommandSeparator alwaysRender />
          <CommandGroup forceMount>
            <CommandItem
              value='__create__'
              forceMount
              onSelect={() => onCreate('')}
            >
              <Plus className='text-muted-foreground size-4' />
              Create new {entityLabel}…
            </CommandItem>
          </CommandGroup>
        </>
      )}
    </>
  )
}
