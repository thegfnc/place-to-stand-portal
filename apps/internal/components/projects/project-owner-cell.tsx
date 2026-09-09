'use client'

import { useMemo, useState, useTransition } from 'react'
import { ChevronDown, UserRoundPlus } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import {
  buildOwnerOptions,
  type AdminUserForOwner,
} from '@/lib/settings/projects/project-sheet-ui-state'
import { cn } from '@/lib/utils'

export type ProjectOwnerSummary = {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export type ProjectOwnerCellProps = {
  projectId: string
  owner: ProjectOwnerSummary | null
  admins: AdminUserForOwner[]
  /** Throw on failure so the cell can roll back its optimistic owner. */
  onOwnerChange: (projectId: string, ownerId: string | null) => Promise<void>
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/**
 * Owner avatar as an instant table-row control: clicking it opens the same
 * searchable owner picker the project edit sheet uses, and picking someone
 * saves immediately with optimistic state + rollback (the ProjectStatusCell
 * precedent — table-row controls may mutate instantly, sheets apply on save).
 */
export function ProjectOwnerCell({
  projectId,
  owner,
  admins,
  onOwnerChange,
}: ProjectOwnerCellProps) {
  const [isPending, startTransition] = useTransition()
  const [optimisticOwnerId, setOptimisticOwnerId] = useState<string | null>(
    owner?.id ?? null
  )

  // Adopt server updates (router.refresh after save) over stale optimism.
  const serverOwnerId = owner?.id ?? null
  const [prevServerOwnerId, setPrevServerOwnerId] = useState(serverOwnerId)
  if (prevServerOwnerId !== serverOwnerId) {
    setPrevServerOwnerId(serverOwnerId)
    setOptimisticOwnerId(serverOwnerId)
  }

  const ownerOptions = useMemo(
    () => buildOwnerOptions(admins, optimisticOwnerId),
    [admins, optimisticOwnerId]
  )

  // While optimistic, the new owner's display data comes from the admin
  // directory; once the refresh lands, the server row takes over again.
  const displayOwner = useMemo<ProjectOwnerSummary | null>(() => {
    if (optimisticOwnerId === serverOwnerId) {
      return owner
    }

    if (!optimisticOwnerId) {
      return null
    }

    const admin = admins.find(entry => entry.id === optimisticOwnerId)
    return admin
      ? {
          id: admin.id,
          full_name: admin.full_name ?? admin.email,
          avatar_url: admin.avatar_url,
        }
      : null
  }, [admins, optimisticOwnerId, owner, serverOwnerId])

  const handleChange = (value: string) => {
    const nextOwnerId = value ? value : null

    if (nextOwnerId === optimisticOwnerId) {
      return
    }

    const previousOwnerId = optimisticOwnerId
    setOptimisticOwnerId(nextOwnerId)

    startTransition(async () => {
      try {
        await onOwnerChange(projectId, nextOwnerId)
      } catch {
        setOptimisticOwnerId(previousOwnerId)
      }
    })
  }

  const triggerLabel = displayOwner
    ? `Change owner (currently ${displayOwner.full_name ?? 'unnamed'})`
    : 'Assign owner'

  return (
    <SearchableCombobox
      items={ownerOptions}
      value={optimisticOwnerId ?? ''}
      onChange={handleChange}
      searchPlaceholder='Search team members...'
      emptyMessage='No team members found.'
      className='w-fit'
      trigger={
        <button
          type='button'
          disabled={isPending}
          aria-label={triggerLabel}
          title={displayOwner?.full_name ?? 'Assign owner'}
          // The whole row navigates on click — the picker must not. Plain
          // onClick (not capture): React delegates events at the root, so a
          // capture-phase stopPropagation would also silence the popover
          // trigger's own merged handler.
          onClick={event => event.stopPropagation()}
          className={cn(
            // ProjectStatusCell's hover treatment: accent surface plus a
            // reveal-on-hover caret, per Jason's ask that the owner cell
            // match the status column.
            // `flex` (block-level), not `inline-flex`: an inline box whose
            // avatar shows an image (no text) baseline-aligns by its bottom
            // edge, and the cell's font strut adds ~4px of phantom space
            // below — rows grew to 44px on prod where avatars load.
            'group focus-visible:ring-ring hover:bg-accent/60 -mx-0.5 flex w-fit cursor-pointer items-center gap-1.5 rounded-md p-0.5 focus:outline-none focus-visible:ring-2',
            isPending && 'animate-pulse'
          )}
        >
          {displayOwner ? (
            <Avatar className='h-6 w-6'>
              {displayOwner.avatar_url && (
                <AvatarImage
                  src={`/api/storage/user-avatar/${displayOwner.id}`}
                  alt={displayOwner.full_name ?? 'Owner'}
                />
              )}
              <AvatarFallback className='text-[9px]'>
                {getInitials(displayOwner.full_name)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Avatar className='h-6 w-6 border border-dashed'>
              <AvatarFallback className='bg-transparent'>
                <UserRoundPlus className='text-muted-foreground/60 h-3.5 w-3.5' />
              </AvatarFallback>
            </Avatar>
          )}
          <ChevronDown className='text-foreground/70 h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100' />
        </button>
      }
    />
  )
}
