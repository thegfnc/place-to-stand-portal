'use client'

import { useMemo } from 'react'

import type { ProjectWithRelations } from '@/lib/types'

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
    const clientSlug =
      activeProject?.client?.slug ??
      (activeProject?.client_id
        ? (clients.find(client => client.id === activeProject.client_id)
            ?.slug ?? null)
        : null)

    const projectSlug = activeProject?.slug ?? null
    const projectPathBase =
      clientSlug && projectSlug
        ? `/projects/${clientSlug}/${projectSlug}`
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
