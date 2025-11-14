import type { ProjectsBoardDialogsProps } from "../../_components/projects-board-dialogs"

type BuildDialogsArgs = {
  activeProject: ProjectsBoardDialogsProps["activeProject"]
  sheetState: ProjectsBoardDialogsProps["sheetState"]
  timeLogState: ProjectsBoardDialogsProps["timeLogState"]
  timeLogHistoryState: ProjectsBoardDialogsProps["timeLogHistoryState"]
}

export function buildProjectsBoardDialogs({
  activeProject,
  sheetState,
  timeLogState,
  timeLogHistoryState,
}: BuildDialogsArgs): ProjectsBoardDialogsProps {
  return {
    activeProject,
    sheetState,
    timeLogState,
    timeLogHistoryState,
  }
}

