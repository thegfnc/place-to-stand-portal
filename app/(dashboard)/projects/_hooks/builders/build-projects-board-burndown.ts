import type { DbClient } from '@/lib/types'

import type { ProjectsBoardBurndownProps } from '../use-projects-board-view-model'

type BuildBurndownArgs = {
  activeProject: {
    client: Pick<DbClient, 'billing_type'> | null
    burndown: {
      totalClientRemainingHours: number
      totalProjectLoggedHours: number
      projectMonthToDateLoggedHours: number
    }
  } | null
  canLogTime: boolean
  addTimeLogDisabledReason: ProjectsBoardBurndownProps['addTimeLogDisabledReason']
  onAddTimeLog: () => void
  viewTimeLogsHref: string | null
}

export function buildProjectsBoardBurndown({
  activeProject,
  canLogTime,
  addTimeLogDisabledReason,
  onAddTimeLog,
  viewTimeLogsHref,
}: BuildBurndownArgs): ProjectsBoardBurndownProps {
  const isNetThirtyClient =
    (activeProject?.client?.billing_type ?? 'prepaid') === 'net_30'

  return {
    visible: Boolean(activeProject),
    totalClientRemainingHours:
      activeProject?.burndown.totalClientRemainingHours ?? 0,
    totalProjectLoggedHours:
      activeProject?.burndown.totalProjectLoggedHours ?? 0,
    projectMonthToDateLoggedHours:
      activeProject?.burndown.projectMonthToDateLoggedHours ?? 0,
    canLogTime,
    addTimeLogDisabledReason,
    onAddTimeLog,
    viewTimeLogsHref,
    showClientRemainingCard:
      (activeProject?.client?.billing_type ?? 'prepaid') !== 'net_30',
    showProjectMonthToDate: isNetThirtyClient,
  }
}
