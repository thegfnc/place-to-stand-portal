import type { ProjectsBoardHeaderProps } from '../use-projects-board-view-model'

type BuildHeaderArgs = {
  projectItems: ProjectsBoardHeaderProps['projectItems']
  selectedProjectId: ProjectsBoardHeaderProps['selectedProjectId']
  onProjectChange: ProjectsBoardHeaderProps['onProjectChange']
  onSelectNextProject: ProjectsBoardHeaderProps['onSelectNextProject']
  onSelectPreviousProject: ProjectsBoardHeaderProps['onSelectPreviousProject']
  canSelectNextProject: ProjectsBoardHeaderProps['canSelectNext']
  canSelectPreviousProject: ProjectsBoardHeaderProps['canSelectPrevious']
}

export function buildProjectsBoardHeader({
  projectItems,
  selectedProjectId,
  onProjectChange,
  onSelectNextProject,
  onSelectPreviousProject,
  canSelectNextProject,
  canSelectPreviousProject,
}: BuildHeaderArgs): ProjectsBoardHeaderProps {
  return {
    projectItems,
    selectedProjectId,
    onProjectChange,
    onSelectNextProject,
    onSelectPreviousProject,
    canSelectNext: canSelectNextProject,
    canSelectPrevious: canSelectPreviousProject,
  }
}

