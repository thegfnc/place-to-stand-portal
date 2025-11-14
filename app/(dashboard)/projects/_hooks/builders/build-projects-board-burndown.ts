import type { ProjectsBoardBurndownProps } from "../use-projects-board-view-model"

type BuildBurndownArgs = {
  activeProject: {
    burndown: {
      totalClientRemainingHours: number
      totalProjectLoggedHours: number
    }
  } | null
  canLogTime: boolean
  addTimeLogDisabledReason: ProjectsBoardBurndownProps["addTimeLogDisabledReason"]
  onAddTimeLog: () => void
  onViewTimeLogs: () => void
}

export function buildProjectsBoardBurndown({
  activeProject,
  canLogTime,
  addTimeLogDisabledReason,
  onAddTimeLog,
  onViewTimeLogs,
}: BuildBurndownArgs): ProjectsBoardBurndownProps {
  return {
    visible: Boolean(activeProject),
    totalClientRemainingHours:
      activeProject?.burndown.totalClientRemainingHours ?? 0,
    totalProjectLoggedHours:
      activeProject?.burndown.totalProjectLoggedHours ?? 0,
    canLogTime,
    addTimeLogDisabledReason,
    onAddTimeLog,
    onViewTimeLogs,
  }
}

