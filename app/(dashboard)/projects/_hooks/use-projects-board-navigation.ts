'use client'

import { useMemo } from 'react'

import type { ProjectWithRelations } from '@/lib/types'
import { getProjectClientSegment } from '@/lib/projects/board/board-utils'

export type ProjectsBoardNavigation = {
  boardHref: string
  calendarHref: string
  backlogHref: string
  activityHref: string
  reviewHref: string
  timeLogsHref: string
  calendarDisabled: boolean
  backlogDisabled: boolean
  activityDisabled: boolean
  reviewDisabled: boolean
  timeLogsDisabled: boolean
}

type UseProjectsBoardNavigationArgs = {
  activeProject: ProjectWithRelations | null
  clients: Array<{ id: string; slug: string | null }>
}

export function useProjectsBoardNavigation({
  activeProject,
  clients,
}: UseProjectsBoardNavigationArgs): ProjectsBoardNavigation {
  return useMemo(() => {
    const clientSlugLookup = new Map(
      clients.map(client => [client.id, client.slug ?? null])
    )

    const clientSegment =
      activeProject && getProjectClientSegment(activeProject, clientSlugLookup)

    const projectSlug = activeProject?.slug ?? null
    const projectPathBase =
      clientSegment && projectSlug
        ? `/projects/${clientSegment}/${projectSlug}`
        : null

    const defaultHref = '/projects'

    return {
      boardHref: projectPathBase ? `${projectPathBase}/board` : defaultHref,
      calendarHref: projectPathBase
        ? `${projectPathBase}/calendar`
        : defaultHref,
      backlogHref: projectPathBase ? `${projectPathBase}/backlog` : defaultHref,
      activityHref: projectPathBase
        ? `${projectPathBase}/activity`
        : defaultHref,
      reviewHref: projectPathBase ? `${projectPathBase}/review` : defaultHref,
      timeLogsHref: projectPathBase
        ? `${projectPathBase}/time-logs`
        : defaultHref,
      calendarDisabled: !projectPathBase,
      backlogDisabled: !projectPathBase,
      activityDisabled: !projectPathBase,
      reviewDisabled: !projectPathBase,
      timeLogsDisabled: !projectPathBase,
    }
  }, [activeProject, clients])
}
