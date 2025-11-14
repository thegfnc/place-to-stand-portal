import type { ProjectsBoardTabsSectionProps } from '../../_components/projects-board/projects-board-tabs-section'
import type { ProjectsBoardNavigation } from '../use-projects-board-navigation'

type BuildTabsArgs = {
  initialTab: ProjectsBoardTabsSectionProps['initialTab']
  navigation: ProjectsBoardNavigation
  assignmentFilter: ProjectsBoardTabsSectionProps['assignmentFilter']
  board: ProjectsBoardTabsSectionProps['board']
  drag: ProjectsBoardTabsSectionProps['drag']
  calendarDrag: ProjectsBoardTabsSectionProps['calendarDrag']
  backlog: ProjectsBoardTabsSectionProps['backlog']
  review: ProjectsBoardTabsSectionProps['review']
  drop: ProjectsBoardTabsSectionProps['drop']
  timeLogs: ProjectsBoardTabsSectionProps['timeLogs']
}

export function buildProjectsBoardTabs({
  initialTab,
  navigation,
  assignmentFilter,
  board,
  drag,
  calendarDrag,
  backlog,
  review,
  drop,
  timeLogs,
}: BuildTabsArgs): ProjectsBoardTabsSectionProps {
  return {
    initialTab,
    navigation,
    assignmentFilter,
    board,
    drag,
    calendarDrag,
    backlog,
    review,
    drop,
    timeLogs,
  }
}

