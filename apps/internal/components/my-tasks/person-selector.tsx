'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { Users } from 'lucide-react'

import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import type { DbUser } from '@/lib/types'

const ALL_TASKS_VALUE = 'all'

type PersonSelectorProps = {
  admins: DbUser[]
  /** An admin id, or `'all'` for the everyone view. */
  selectedUserId: string
  currentUserId: string
  disabled?: boolean
}

export function PersonSelector({
  admins,
  selectedUserId,
  currentUserId,
  disabled = false,
}: PersonSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const items: SearchableComboboxItem[] = useMemo(
    () => {
      const mappedItems = admins.map(admin => ({
        value: admin.id,
        label: admin.full_name ?? admin.email ?? 'Unknown',
        avatarUrl: admin.avatar_url,
        userId: admin.id,
      }))

      // Sort: current user first, then alphabetically by label
      mappedItems.sort((a, b) => {
        if (a.userId === currentUserId) return -1
        if (b.userId === currentUserId) return 1
        return a.label.localeCompare(b.label)
      })

      // Everyone's tasks — for the weekly planning walk-through.
      return [
        {
          value: ALL_TASKS_VALUE,
          label: 'All tasks',
          keywords: ['all', 'everyone'],
          icon: Users,
        },
        ...mappedItems,
      ]
    },
    [admins, currentUserId]
  )

  const handleChange = useCallback(
    (userId: string) => {
      const params = new URLSearchParams(searchParams.toString())

      if (userId) {
        params.set('assignee', userId)
      } else {
        params.delete('assignee')
      }

      // Person-scoped sort metadata has no meaning across boards, and the
      // sheet params should survive the switch untouched.

      const search = params.toString()
      const url = search ? `${pathname}?${search}` : pathname

      router.push(url, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return (
    // Grid-stacked invisible sizers pin the trigger width to the widest
    // option (mimicking the trigger's avatar + padding + chevron chrome),
    // so switching people never shifts the toolbar.
    <div className="grid">
      <div
        aria-hidden="true"
        className="pointer-events-none invisible col-start-1 row-start-1 overflow-hidden"
      >
        {items.map(item => (
          <span
            key={item.value}
            className='flex h-0 items-center gap-2 border-x border-x-transparent px-3 text-sm whitespace-nowrap'
          >
            <span className="size-5 shrink-0" />
            {item.label}
            <span className="size-4 shrink-0" />
          </span>
        ))}
      </div>
      <div className="col-start-1 row-start-1">
        <SearchableCombobox
          items={items}
          value={selectedUserId}
          onChange={handleChange}
          placeholder="Select person"
          searchPlaceholder="Search team members..."
          emptyMessage="No team members found."
          disabled={disabled}
          className="w-full"
          triggerClassName="h-8 py-0 text-sm"
          itemClassName="whitespace-nowrap"
        />
      </div>
    </div>
  )
}
