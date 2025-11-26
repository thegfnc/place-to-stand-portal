import type { ProjectsBoardHeaderProps } from '../use-projects-board-view-model'

type BuildHeaderArgs = {
  projectItems: ProjectsBoardHeaderProps['projectItems']
  projectGroups?: ProjectsBoardHeaderProps['projectGroups']
  selectedProjectId: ProjectsBoardHeaderProps['selectedProjectId']
  onProjectChange: ProjectsBoardHeaderProps['onProjectChange']
  onSelectNextProject: ProjectsBoardHeaderProps['onSelectNextProject']
  onSelectPreviousProject: ProjectsBoardHeaderProps['onSelectPreviousProject']
  canSelectNextProject: ProjectsBoardHeaderProps['canSelectNext']
  canSelectPreviousProject: ProjectsBoardHeaderProps['canSelectPrevious']
}

export function buildProjectsBoardHeader({
  projectItems,
  projectGroups,
  selectedProjectId,
  onProjectChange,
  onSelectNextProject,
  onSelectPreviousProject,
  canSelectNextProject,
  canSelectPreviousProject,
}: BuildHeaderArgs): ProjectsBoardHeaderProps {
  return {
    projectItems,
    projectGroups,
    selectedProjectId,
    onProjectChange,
    onSelectNextProject,
    onSelectPreviousProject,
    canSelectNext: canSelectNextProject,
    canSelectPrevious: canSelectPreviousProject,
  }
}

