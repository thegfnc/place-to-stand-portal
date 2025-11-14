import type { ProjectsBoardDialogsProps } from '../../_components/projects-board-dialogs'

type BuildDialogsArgs = {
  activeProject: ProjectsBoardDialogsProps['activeProject']
  sheetState: ProjectsBoardDialogsProps['sheetState']
  timeLogState: ProjectsBoardDialogsProps['timeLogState']
}

export function buildProjectsBoardDialogs({
  activeProject,
  sheetState,
  timeLogState,
}: BuildDialogsArgs): ProjectsBoardDialogsProps {
  return {
    activeProject,
    sheetState,
    timeLogState,
  }
}

