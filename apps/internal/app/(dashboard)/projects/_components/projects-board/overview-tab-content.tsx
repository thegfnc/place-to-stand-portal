'use client'

import Link from 'next/link'
import { Calendar, Info } from 'lucide-react'
import { siGithub } from 'simple-icons/icons'
import { IntegrationProviderIcon } from '@/components/integrations/provider-icon'
import { formatIntegrationLinkLabel } from '@/lib/types/integrations'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { TabsContent } from '@pts/ui/tabs'
import { getProjectStatusLabel, getProjectStatusToken } from '@/lib/constants'
import { formatProjectDateRange } from '@/lib/settings/projects/project-formatters'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { prefetchSheetInit } from '@/lib/sheets/wrappers/use-sheet-init'
import { cn } from '@/lib/utils'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import {
  NO_SELECTION_DESCRIPTION,
  NO_SELECTION_TITLE,
} from './projects-board-tabs.constants'
import type { ProjectsBoardActiveProject } from './board-tab-content'

export type OverviewTabContentProps = {
  isActive: boolean
  activeProject: ProjectsBoardActiveProject
}

export function OverviewTabContent(props: OverviewTabContentProps) {
  const { isActive, activeProject } = props

  if (!isActive) {
    return null
  }

  return (
    <TabsContent
      value='overview'
      className='flex min-h-0 flex-1 flex-col gap-4 pb-8 sm:gap-6'
    >
      {!activeProject ? (
        <ProjectsBoardEmpty
          title={NO_SELECTION_TITLE}
          description={NO_SELECTION_DESCRIPTION}
        />
      ) : (
        <div className='grid gap-4 lg:grid-cols-2'>
          <div className='space-y-4'>
            <ProjectDetailsWidget project={activeProject} />
          </div>
        </div>
      )}
    </TabsContent>
  )
}

function SimpleIcon({
  icon,
  className,
}: {
  icon: { title: string; path: string }
  className?: string
}) {
  return (
    <svg
      role='img'
      viewBox='0 0 24 24'
      className={className}
      xmlns='http://www.w3.org/2000/svg'
      fill='currentColor'
    >
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  )
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function ProjectDetailsWidget({
  project,
}: {
  project: NonNullable<ProjectsBoardActiveProject>
}) {
  // Owner opens the user sheet over this page via `?user=` (global SheetHost).
  const { open } = useSheetParams()
  const owner = project.owner
  const statusLabel = getProjectStatusLabel(project.status)
  const statusToken = getProjectStatusToken(project.status)
  const dateRange = formatProjectDateRange(project.starts_on, project.ends_on)

  return (
    <section className='bg-card text-card-foreground overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-3 border-b px-4 py-3'>
        <div className='flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10'>
          <Info className='h-4 w-4 text-emerald-500' />
        </div>
        <h2 className='font-semibold'>Project Details</h2>
      </div>
      <div className='divide-y'>
        <DetailRow label='Name' value={project.name} />
        {project.slug && (
          <DetailRow label='Slug' value={project.slug} mono />
        )}
        <div className='flex items-center gap-3 px-4 py-2.5'>
          <span className='text-muted-foreground text-sm'>Status</span>
          <Badge className={cn('ml-auto text-[10px]', statusToken)}>
            {statusLabel}
          </Badge>
        </div>
        {project.client?.name && (
          <div className='flex items-center gap-3 px-4 py-2.5'>
            <span className='text-muted-foreground text-sm'>Client</span>
            <div className='ml-auto flex items-center gap-2'>
              <Link
                href={
                  project.client.slug
                    ? `/clients/${project.client.slug}`
                    : `/clients/${project.client.id}`
                }
                className='text-sm font-medium underline-offset-4 hover:underline'
              >
                {project.client.name}
              </Link>
              {project.client.billing_type && (
                <Badge variant='outline' className='text-[10px] font-medium'>
                  {project.client.billing_type === 'net_30' ? 'Net 30' : 'Prepaid'}
                </Badge>
              )}
            </div>
          </div>
        )}
        <div className='flex items-center gap-3 px-4 py-2.5'>
          <span className='text-muted-foreground text-sm'>Owner</span>
          <div className='ml-auto flex items-center gap-2'>
            {owner ? (
              <button
                type='button'
                className='group flex cursor-pointer items-center gap-2'
                onPointerEnter={() => prefetchSheetInit('user', owner.id)}
                onClick={() => open('user', owner.id)}
              >
                <Avatar className='h-6 w-6'>
                  {owner.avatar_url && (
                    <AvatarImage
                      src={`/api/storage/user-avatar/${owner.id}`}
                      alt={owner.full_name ?? 'Owner'}
                    />
                  )}
                  <AvatarFallback className='text-[10px]'>
                    {getInitials(owner.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className='text-sm font-medium underline-offset-4 group-hover:underline'>
                  {owner.full_name ?? 'Unknown'}
                </span>
              </button>
            ) : (
              <span className='text-muted-foreground/60 text-sm'>—</span>
            )}
          </div>
        </div>
        {dateRange !== '—' && (
          <div className='flex items-center gap-3 px-4 py-2.5'>
            <span className='text-muted-foreground text-sm'>Dates</span>
            <div className='ml-auto flex items-center gap-1.5'>
              <Calendar className='text-muted-foreground h-3.5 w-3.5' />
              <span className='text-sm font-medium'>{dateRange}</span>
            </div>
          </div>
        )}
        {project.burndown && (
          <>
            <DetailRow
              label='Hours logged'
              value={`${project.burndown.totalProjectLoggedHours.toFixed(2)}h`}
            />
            {project.burndown.totalClientRemainingHours > 0 && (
              <DetailRow
                label='Client hours remaining'
                value={`${project.burndown.totalClientRemainingHours.toFixed(2)}h`}
              />
            )}
          </>
        )}
        {project.githubRepos.length > 0 && (
          <div className='flex items-center gap-3 px-4 py-2.5'>
            <span className='text-muted-foreground text-sm'>Repos</span>
            <div className='ml-auto flex flex-col items-end gap-1'>
              {project.githubRepos.map(repo => (
                <a
                  key={repo.id}
                  href={`https://github.com/${repo.repoFullName}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors'
                >
                  <SimpleIcon icon={siGithub} className='h-3.5 w-3.5' />
                  <span className='font-medium'>{repo.repoFullName}</span>
                </a>
              ))}
            </div>
          </div>
        )}
        {project.integrationLinks.length > 0 && (
          <div className='flex items-center gap-3 px-4 py-2.5'>
            <span className='text-muted-foreground text-sm'>Hosting</span>
            <div className='ml-auto flex flex-col items-end gap-1'>
              {project.integrationLinks.map(link => (
                <a
                  key={link.id}
                  href={link.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors'
                >
                  <IntegrationProviderIcon
                    provider={link.provider}
                    className='h-3.5 w-3.5'
                  />
                  <span className='font-medium'>
                    {formatIntegrationLinkLabel(link)}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className='flex items-center gap-3 px-4 py-2.5'>
      <span className='text-muted-foreground text-sm'>{label}</span>
      <span
        className={cn(
          'ml-auto text-sm font-medium',
          mono && 'font-mono text-xs'
        )}
      >
        {value}
      </span>
    </div>
  )
}

