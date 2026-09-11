'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Building2,
  CheckCircle,
  FolderKanban,
  UserPlus,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@pts/ui/button'
import { Skeleton } from '@pts/ui/skeleton'
import { getProjectStatusLabel, getProjectStatusToken } from '@/lib/constants'
import { formatCalendarDate } from '@/lib/dates'
import type { LeadConversionSummary, LeadRecord } from '@/lib/leads/types'
import {
  clientDetailHref,
  contactSheetHref,
  projectBoardHref,
} from '@/lib/sheets/hrefs'
import { cn } from '@/lib/utils'

const MAX_PROJECTS = 4

type LeadConversionSectionProps = {
  lead: LeadRecord
  canConvert: boolean
  onConvertToClient: () => void
}

/**
 * Sits above Tasks: what a converted lead became (client, contact, projects),
 * or the convert action once a lead is closed won.
 */
export function LeadConversionSection({
  lead,
  canConvert,
  onConvertToClient,
}: LeadConversionSectionProps) {
  if (lead.convertedToClientId) {
    return (
      <ConvertedSummary
        // Keyed so a re-conversion starts from a fresh loading state.
        key={lead.convertedToClientId}
        leadId={lead.id}
        convertedAt={lead.convertedAt}
      />
    )
  }

  if (!canConvert) return null

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <UserPlus className='text-muted-foreground h-4 w-4' />
          <span className='text-sm font-medium'>Client</span>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={onConvertToClient}
        >
          <UserPlus className='h-3 w-3' />
          Convert
        </Button>
      </div>
      <p className='text-muted-foreground text-sm'>
        Not converted to a client yet.
      </p>
    </div>
  )
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; summary: LeadConversionSummary | null }
  | { status: 'error' }

function ConvertedSummary({
  leadId,
  convertedAt,
}: {
  leadId: string
  convertedAt: string | null
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    // Promise-chained so every setState runs asynchronously.
    fetch(`/api/leads/${leadId}/conversion`)
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const body = (await response.json()) as {
          data?: LeadConversionSummary | null
        }
        if (!cancelled) setState({ status: 'ready', summary: body.data ?? null })
      })
      .catch(error => {
        console.error('Failed to fetch lead conversion:', error)
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [leadId])

  const convertedOn = formatCalendarDate(convertedAt)

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <CheckCircle className='h-4 w-4 text-green-600 dark:text-green-400' />
          <span className='text-sm font-medium'>Converted</span>
        </div>
        {convertedOn && (
          <span className='text-muted-foreground text-xs'>{convertedOn}</span>
        )}
      </div>

      {state.status === 'loading' ? (
        <Skeleton className='h-28 w-full' />
      ) : state.status === 'error' ? (
        <p className='text-muted-foreground text-sm'>
          Couldn&apos;t load what this lead converted into.
        </p>
      ) : state.summary ? (
        <ConvertedRecords summary={state.summary} />
      ) : (
        <p className='text-muted-foreground text-sm'>
          The converted client is no longer available.
        </p>
      )}
    </div>
  )
}

function ConvertedRecords({ summary }: { summary: LeadConversionSummary }) {
  const { client, contact, projects } = summary
  const clientHref = clientDetailHref(client)
  const clientSegment = client.slug ?? client.id
  const hiddenProjectCount = projects.length - MAX_PROJECTS

  return (
    <div className='space-y-2'>
      <ul className='bg-card divide-y overflow-hidden rounded-md border'>
        <RecordRow
          icon={Building2}
          label='Client'
          name={client.name}
          href={client.archived ? null : clientHref}
          trailing={
            client.archived ? (
              <Badge variant='outline' className='text-xs'>
                Archived
              </Badge>
            ) : null
          }
        />
        {contact && (
          <RecordRow
            icon={UserRound}
            label='Contact'
            name={contact.name}
            href={contactSheetHref(contact.id)}
          />
        )}
        {projects.slice(0, MAX_PROJECTS).map(project => (
          <RecordRow
            key={project.id}
            icon={FolderKanban}
            label='Project'
            name={project.name}
            href={projectBoardHref(clientSegment, project.slug ?? project.id)}
            trailing={
              <Badge
                variant='outline'
                className={cn('text-xs', getProjectStatusToken(project.status))}
              >
                {getProjectStatusLabel(project.status)}
              </Badge>
            }
          />
        ))}
      </ul>
      {hiddenProjectCount > 0 && !client.archived && (
        <Link
          href={clientHref}
          className='text-muted-foreground hover:text-foreground block text-xs'
        >
          +{hiddenProjectCount} more {hiddenProjectCount === 1 ? 'project' : 'projects'}
        </Link>
      )}
    </div>
  )
}

function RecordRow({
  icon: Icon,
  label,
  name,
  href,
  trailing,
}: {
  icon: LucideIcon
  label: string
  name: string
  href: string | null
  trailing?: ReactNode
}) {
  const content = (
    <>
      <Icon className='text-muted-foreground size-4 shrink-0' aria-hidden />
      <div className='min-w-0 flex-1'>
        <p className='text-muted-foreground text-xs'>{label}</p>
        <p className='truncate text-sm font-medium'>{name}</p>
      </div>
      {trailing}
    </>
  )

  return (
    <li>
      {href ? (
        <Link
          href={href}
          className='hover:bg-muted/60 focus-visible:bg-muted/60 flex items-center gap-3 px-3 py-2 transition-colors outline-none'
        >
          {content}
        </Link>
      ) : (
        <div className='flex items-center gap-3 px-3 py-2'>{content}</div>
      )}
    </li>
  )
}
