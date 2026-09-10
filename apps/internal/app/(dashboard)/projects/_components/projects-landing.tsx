'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState, useTransition } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Archive,
  Building2,
  Clock,
  FolderKanban,
  Pencil,
  UserRound,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { siGithub } from 'simple-icons/icons'
import { IntegrationProviderIcon } from '@/components/integrations/provider-icon'
import { formatIntegrationLinkLabel } from '@/lib/types/integrations'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'

import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Progress } from '@pts/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import { ProjectStatusCell } from '@/components/projects/project-status-cell'
import { ProjectOwnerCell } from '@/components/projects/project-owner-cell'
import type { ProjectStatusValue } from '@/lib/constants'
import type { AdminUserForOwner } from '@/lib/settings/projects/project-sheet-ui-state'
import { formatProjectDateRange } from '@/lib/settings/projects/project-formatters'
import { buildBoardPath } from '@/lib/projects/board/board-utils'
import {
  createProjectLookup,
  createProjectsByClientLookup,
  createClientSlugLookup,
} from '@/lib/projects/board/board-utils'
import { updateProjectStatus } from '@/lib/settings/projects/actions/update-project-status'
import { updateProjectOwner } from '@/lib/settings/projects/actions/update-project-owner'
import { softDeleteProject } from '@/app/(dashboard)/settings/projects/actions'
import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'
import { PENDING_REASON } from '@/lib/forms/form-controls'
import type { LandingProject } from '@/lib/data/projects'
import { cn } from '@/lib/utils'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

// PRD 004 §03: per-view sort allowlist. One shared `?sort` drives the Name
// column in all three section tables; grouping semantics stay unchanged —
// only the project ordering within each section/client group flips.
const PROJECT_SORT_FIELDS = ['name'] as const

function isProjectSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (PROJECT_SORT_FIELDS as readonly string[]).includes(field) &&
    (direction === 'asc' || direction === 'desc')
  )
}

const HOURS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

function formatHours(hours: number): string {
  return HOURS_FORMATTER.format(hours)
}

function SimpleIcon({
  icon,
  className,
  color,
}: {
  icon: { title: string; path: string; hex: string }
  className?: string
  color?: string
}) {
  return (
    <svg
      role='img'
      viewBox='0 0 24 24'
      className={className}
      xmlns='http://www.w3.org/2000/svg'
      fill={color || 'currentColor'}
    >
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  )
}

export type ClientHoursData =
  | {
      billingType: 'prepaid'
      hoursRemaining: number
      totalHoursPurchased: number
    }
  | {
      billingType: 'net_30'
    }

type ClientProjectSection = {
  client: { id: string; name: string; slug: string | null }
  projects: LandingProject[]
}

export type LandingUnfilteredCounts = {
  /** All projects visible to this user, pre-filter. */
  total: number
  clientCount: number
  internalCount: number
  personalCount: number
}

type ProjectsLandingProps = {
  /** Already filtered server-side (status + search); this component only groups/renders. */
  projects: LandingProject[]
  clients: Array<{ id: string; name: string; slug: string | null }>
  /** Owner picker options for the avatar cell (same list the edit sheet uses). */
  admins: AdminUserForOwner[]
  currentUserId: string
  clientHoursMap?: Record<string, ClientHoursData>
  /** Pre-filter counts — drive the empty-state wording per section. */
  unfilteredCounts: LandingUnfilteredCounts
  /** True when the URL deviates from the clean landing (status or search). */
  filtersActive: boolean
}

type SectionConfig = {
  key: 'client' | 'internal' | 'personal'
  title: string
  icon: LucideIcon
  count: number
  content: ReactNode
}

type ExternalLinkItem = {
  key: string
  href: string
  label: string
  icon: ReactNode
}

/** Every repo and hosting link on a project, in provider order, as icons. */
const buildExternalLinks = (project: LandingProject): ExternalLinkItem[] => [
  ...project.githubRepos.map(repo => ({
    key: `github-${repo.id}`,
    href: `https://github.com/${repo.repoFullName}`,
    label: repo.repoFullName,
    icon: <SimpleIcon icon={siGithub} className='h-4 w-4' />,
  })),
  ...project.integrationLinks.map(link => ({
    key: `${link.provider}-${link.id}`,
    href: link.url,
    label: formatIntegrationLinkLabel(link),
    icon: <IntegrationProviderIcon provider={link.provider} className='h-4 w-4' />,
  })),
]

export function ProjectsLanding({
  projects,
  clients,
  admins,
  currentUserId,
  clientHoursMap = {},
  unfilteredCounts,
  filtersActive,
}: ProjectsLandingProps) {
  const router = useRouter()
  const { toast } = useToast()

  // Edit opens the global `?project=` sheet: the landing rows omit fields the
  // sheet needs, so the dashboard SheetHost resolves the id server-side.
  const { select: openProjectSheet } = useSheetParamSelection('project')

  const [deleteTarget, setDeleteTarget] = useState<LandingProject | null>(null)
  const [isArchivePending, startArchiveTransition] = useTransition()

  const handleRequestDelete = (project: LandingProject) => {
    if (isArchivePending) {
      return
    }
    setDeleteTarget(project)
  }

  const handleCancelDelete = () => {
    if (isArchivePending) {
      return
    }
    setDeleteTarget(null)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) {
      return
    }

    const project = deleteTarget
    setDeleteTarget(null)

    startArchiveTransition(async () => {
      const result = await softDeleteProject({ id: project.id })

      if (result.error) {
        toast({
          title: 'Unable to archive project',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Project archived',
        description: `${project.name} is hidden from active views but remains in historical reporting.`,
      })
      router.refresh()
    })
  }

  const { update, getParam } = useListParams({
    basePath: '/projects',
    resetKeys: [],
  })
  const rawSort = getParam('sort')
  const sort = rawSort && isProjectSortValue(rawSort) ? rawSort : undefined
  const sortFactor = sort === 'name:desc' ? -1 : 1

  // Handle status change for a project
  const handleProjectStatusChange = useCallback(
    async (projectId: string, status: ProjectStatusValue) => {
      const result = await updateProjectStatus({ projectId, status })

      if (result.error) {
        toast({
          title: 'Failed to update status',
          description: result.error,
          variant: 'destructive',
        })
        throw new Error(result.error)
      }

      router.refresh()
    },
    [router, toast]
  )

  // Same instant-mutation contract as status: throw on failure so the cell
  // rolls back its optimistic owner.
  const handleProjectOwnerChange = useCallback(
    async (projectId: string, ownerId: string | null) => {
      const result = await updateProjectOwner({ projectId, ownerId })

      if (result.error) {
        toast({
          title: 'Failed to update owner',
          description: result.error,
          variant: 'destructive',
        })
        throw new Error(result.error)
      }

      router.refresh()
    },
    [router, toast]
  )

  const { clientSections, internalProjects, personalProjects } = useMemo(() => {
    const clientMap = new Map<string, ClientProjectSection>()
    const internal: LandingProject[] = []
    const personal: LandingProject[] = []

    projects.forEach(project => {
      if (project.type === 'INTERNAL') {
        internal.push(project)
        return
      }

      if (project.type === 'PERSONAL') {
        if (project.created_by === currentUserId) {
          personal.push(project)
        }
        return
      }

      if (!project.client_id || !project.client) {
        return
      }

      const existing = clientMap.get(project.client_id)
      if (existing) {
        existing.projects.push(project)
      } else {
        clientMap.set(project.client_id, {
          client: {
            id: project.client.id,
            name: project.client.name,
            slug: project.client.slug,
          },
          projects: [project],
        })
      }
    })

    // Sort flips asc/desc per `?sort`; client groups stay alphabetical (asc)
    // so only project ordering within each section/group changes.
    clientMap.forEach(entry => {
      entry.projects.sort(
        (a, b) => a.name.localeCompare(b.name) * sortFactor
      )
    })

    internal.sort((a, b) => a.name.localeCompare(b.name) * sortFactor)
    personal.sort((a, b) => a.name.localeCompare(b.name) * sortFactor)

    const sortedClientSections = Array.from(clientMap.values()).sort((a, b) =>
      a.client.name.localeCompare(b.client.name)
    )

    return {
      clientSections: sortedClientSections,
      internalProjects: internal,
      personalProjects: personal,
    }
  }, [projects, currentUserId, sortFactor])

  const projectLookup = useMemo(() => createProjectLookup(projects), [projects])
  const projectsByClientId = useMemo(
    () => createProjectsByClientLookup(projects),
    [projects]
  )
  const clientSlugLookup = useMemo(
    () => createClientSlugLookup(clients),
    [clients]
  )

  const getProjectHref = (project: LandingProject) => {
    const path = buildBoardPath(
      project.id,
      {
        projectLookup,
        projectsByClientId,
        clientSlugLookup,
      },
      { view: 'board' }
    )
    return path ?? '#'
  }

  const allSectionsEmpty =
    clientSections.length === 0 &&
    internalProjects.length === 0 &&
    personalProjects.length === 0

  if (unfilteredCounts.total === 0) {
    return (
      <div className='grid h-full w-full place-items-center rounded-xl border border-dashed p-12 text-center'>
        <div className='space-y-2'>
          <h2 className='text-lg font-semibold'>No projects found</h2>
          <p className='text-muted-foreground text-sm'>
            Projects will appear here once they are created.
          </p>
        </div>
      </div>
    )
  }

  // Filtered-empty: an active filter/search left all three sections empty.
  if (allSectionsEmpty && filtersActive) {
    return (
      <div className='grid h-full w-full place-items-center rounded-xl border border-dashed p-12 text-center'>
        <p className='text-muted-foreground text-sm'>
          No projects match the current filters.
        </p>
      </div>
    )
  }

  const renderSectionEmptyState = (message: string) => (
    <div className='text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm'>
      {message}
    </div>
  )

  const renderProjectRow = (
    project: LandingProject,
    options?: { indent?: boolean; isLast?: boolean }
  ) => {
    const href = getProjectHref(project)
    const dateRange = formatProjectDateRange(project.starts_on, project.ends_on)

    const { done: doneCount, total: totalCount } = project.taskProgress
    const progressPercentage =
      totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

    const treeLine = options?.indent ? (options.isLast ? '└' : '├') : null
    const externalLinks = buildExternalLinks(project)

    return (
      <TableRow
        key={project.id}
        {...(href !== '#'
          ? getClickableRowProps(() => router.push(href))
          : {})}
        className={href !== '#' ? CLICKABLE_ROW_CLASS : undefined}
      >
        <TableCell>
          <div className='flex min-w-0 items-center'>
            {treeLine && (
              <span className='text-muted-foreground/30 mr-2 w-4 shrink-0 text-center font-mono'>
                {treeLine}
              </span>
            )}
            <Link
              href={href}
              className='flex min-w-0 items-center gap-2 py-1'
            >
              <FolderKanban className='h-4 w-4 shrink-0 text-emerald-500' />
              <span className='truncate font-medium'>{project.name}</span>
            </Link>
          </div>
        </TableCell>
        <TableCell>
          <ProjectStatusCell
            projectId={project.id}
            status={project.status}
            onStatusChange={handleProjectStatusChange}
          />
        </TableCell>
        <TableCell>
          <div className='flex items-center gap-3'>
            <Progress value={progressPercentage} className='h-2 w-24' />
            <span className='text-muted-foreground text-xs'>
              {doneCount}/{totalCount}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <span className='text-muted-foreground text-sm'>
            {dateRange !== '—' ? dateRange : '—'}
          </span>
        </TableCell>
        <TableCell className='align-middle'>
          <ProjectOwnerCell
            projectId={project.id}
            owner={project.owner}
            admins={admins}
            onOwnerChange={handleProjectOwnerChange}
          />
        </TableCell>
        <TableCell className='align-middle'>
          <div className='flex h-full flex-wrap items-center gap-1.5'>
            {externalLinks.length > 0 ? (
              externalLinks.map(link => (
                <Tooltip key={link.key}>
                  <TooltipTrigger asChild>
                    <a
                      href={link.href}
                      target='_blank'
                      rel='noopener noreferrer'
                      aria-label={link.label}
                      className='text-muted-foreground hover:text-foreground inline-flex items-center transition-colors'
                    >
                      {link.icon}
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>{link.label}</TooltipContent>
                </Tooltip>
              ))
            ) : (
              <span className='text-muted-foreground/40'>—</span>
            )}
          </div>
        </TableCell>
        <TableCell className='text-right'>
          <div className='flex justify-end gap-2'>
            <Button
              variant='outline'
              size='icon-sm'
              onClick={() => openProjectSheet(project.id)}
              title='Edit project'
              aria-label='Edit project'
              disabled={isArchivePending}
            >
              <Pencil className='h-4 w-4' />
              <span className='sr-only'>Edit</span>
            </Button>
            <DisabledFieldTooltip
              disabled={isArchivePending}
              reason={isArchivePending ? PENDING_REASON : null}
            >
              <Button
                variant='destructive'
                size='icon-sm'
                onClick={() => handleRequestDelete(project)}
                title='Archive project'
                aria-label='Archive project'
                disabled={isArchivePending}
              >
                <Archive className='h-4 w-4' />
                <span className='sr-only'>Archive</span>
              </Button>
            </DisabledFieldTooltip>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  const tableColumnWidths = {
    project: 'w-[28%]',
    status: 'w-[11%]',
    progress: 'w-[18%]',
    dates: 'w-[14%]',
    owner: 'w-[7%]',
    links: 'w-[11%]',
    actions: 'w-24',
  }

  const renderProjectTable = (items: LandingProject[]) => (
    <div className='rounded-lg border'>
      <Table density='compact' layout='fixed'>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <SortableTableHead
              field='name'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
              className={tableColumnWidths.project}
            >
              Project
            </SortableTableHead>
            <TableHead className={tableColumnWidths.status}>Status</TableHead>
            <TableHead className={tableColumnWidths.progress}>
              Progress
            </TableHead>
            <TableHead className={tableColumnWidths.dates}>Dates</TableHead>
            <TableHead className={tableColumnWidths.owner}>Owner</TableHead>
            <TableHead className={tableColumnWidths.links}>Links</TableHead>
            <TableHead className={`${tableColumnWidths.actions} text-right`}>
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{items.map(project => renderProjectRow(project))}</TableBody>
      </Table>
    </div>
  )

  const renderClientSeparatorRow = (client: {
    id: string
    name: string
    slug: string | null
  }) => {
    const hours = clientHoursMap[client.id]

    return (
      <TableRow
        key={`client-${client.id}`}
        className='border-t-muted hover:bg-transparent'
      >
        <TableCell
          colSpan={7}
          className='bg-blue-100 py-2.5 align-middle dark:bg-blue-500/8'
        >
          <div className='flex items-center gap-4'>
            <Link
              href={
                client.slug
                  ? `/clients/${client.slug}`
                  : `/clients/${client.id}`
              }
              className='flex w-fit shrink items-center gap-2 underline-offset-4 opacity-65 hover:underline'
            >
              <Building2 className='h-4 w-4 shrink-0 text-blue-500/80' />
              <span className='text-sm font-semibold'>{client.name}</span>
            </Link>
            {hours && hours.billingType === 'prepaid' && (
              <div className='flex items-center gap-1.25 text-[11px]'>
                <Clock
                  className={cn(
                    'h-3 w-3',
                    hours.hoursRemaining > 0
                      ? 'text-emerald-600'
                      : hours.hoursRemaining === 0
                        ? 'text-muted-foreground'
                        : 'text-red-600'
                  )}
                />
                <span
                  className={cn(
                    hours.hoursRemaining > 0
                      ? 'font-medium text-emerald-600'
                      : hours.hoursRemaining === 0
                        ? 'text-muted-foreground'
                        : 'font-medium text-red-600'
                  )}
                >
                  {formatHours(hours.hoursRemaining)}h remaining
                </span>
              </div>
            )}
            {hours && hours.billingType === 'net_30' && (
              <div className='flex items-center gap-1.25 text-[11px]'>
                <Clock className='text-muted-foreground h-3 w-3' />
                <span className='text-muted-foreground font-medium'>
                  Net 30
                </span>
              </div>
            )}
          </div>
        </TableCell>
      </TableRow>
    )
  }

  const clientSectionContent =
    clientSections.length > 0 ? (
      <div className='rounded-lg border'>
        <Table density='compact' layout='fixed'>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <SortableTableHead
                field='name'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className={tableColumnWidths.project}
              >
                Project
              </SortableTableHead>
              <TableHead className={tableColumnWidths.status}>Status</TableHead>
              <TableHead className={tableColumnWidths.progress}>
                Progress
              </TableHead>
              <TableHead className={tableColumnWidths.dates}>Dates</TableHead>
              <TableHead className={tableColumnWidths.owner}>Owner</TableHead>
              <TableHead className={tableColumnWidths.links}>Links</TableHead>
              <TableHead className={`${tableColumnWidths.actions} text-right`}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientSections.flatMap(({ client, projects: clientProjects }) => [
              renderClientSeparatorRow(client),
              ...clientProjects.map((project, index) =>
                renderProjectRow(project, {
                  indent: true,
                  isLast: index === clientProjects.length - 1,
                })
              ),
            ])}
          </TableBody>
        </Table>
      </div>
    ) : (
      renderSectionEmptyState(
        unfilteredCounts.clientCount > 0
          ? 'No client projects match the current filters.'
          : 'Client projects will appear here once they are created.'
      )
    )

  const getInternalEmptyMessage = () => {
    if (unfilteredCounts.internalCount > 0) {
      return 'No internal projects match the current filters.'
    }
    return 'There are no internal projects yet.'
  }

  const getPersonalEmptyMessage = () => {
    if (unfilteredCounts.personalCount > 0) {
      return 'No personal projects match the current filters.'
    }
    return 'You have not created any personal projects yet.'
  }

  const sectionConfigs: (SectionConfig & { className?: string })[] = [
    {
      key: 'internal',
      title: 'Internal Projects',
      icon: Users,
      count: internalProjects.length,
      content:
        internalProjects.length > 0
          ? renderProjectTable(internalProjects)
          : renderSectionEmptyState(getInternalEmptyMessage()),
    },
    {
      key: 'personal',
      title: 'Personal Projects',
      icon: UserRound,
      count: personalProjects.length,
      content:
        personalProjects.length > 0
          ? renderProjectTable(personalProjects)
          : renderSectionEmptyState(getPersonalEmptyMessage()),
    },
  ]

  return (
    <div className='space-y-12'>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title='Archive project?'
        description={
          deleteTarget
            ? `Archiving ${deleteTarget.name} hides it from active views but keeps the history intact.`
            : 'Archiving this project hides it from active views but keeps the history intact.'
        }
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={isArchivePending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      <div className='space-y-6'>{clientSectionContent}</div>
      {sectionConfigs.map(
        ({ key, title, icon: Icon, count, content, className }) => (
          <div key={key} className={cn('space-y-4', className)}>
            <div className='flex items-center gap-2'>
              <div className='bg-accent flex h-8 w-8 items-center justify-center rounded-md border shadow-sm'>
                <Icon className='text-muted-foreground h-4 w-4' />
              </div>
              <h2 className='text-base font-semibold'>{title}</h2>
              <span className='text-muted-foreground text-sm'>({count})</span>
            </div>
            <div>{content}</div>
          </div>
        )
      )}
    </div>
  )
}
