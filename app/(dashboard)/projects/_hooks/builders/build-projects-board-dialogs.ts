import type { ProjectsBoardDialogsProps } from '../../_components/projects-board-dialogs'

type BuildDialogsArgs = {
  activeProject: ProjectsBoardDialogsProps['activeProject']
  sheetState: ProjectsBoardDialogsProps['sheetState']
  timeLogState: ProjectsBoardDialogsProps['timeLogState']
  projects: ProjectsBoardDialogsProps['projects']
}

export function buildProjectsBoardDialogs({
  activeProject,
  sheetState,
  timeLogState,
  projects,
}: BuildDialogsArgs): ProjectsBoardDialogsProps {
  return {
    activeProject,
    sheetState,
    timeLogState,
    projects,
  }
}

