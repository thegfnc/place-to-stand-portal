import type { ProjectsBoardHeaderProps } from "../use-projects-board-view-model"

type BuildHeaderArgs = {
  clientItems: ProjectsBoardHeaderProps["clientItems"]
  projectItems: ProjectsBoardHeaderProps["projectItems"]
  selectedClientId: ProjectsBoardHeaderProps["selectedClientId"]
  selectedProjectId: ProjectsBoardHeaderProps["selectedProjectId"]
  onClientChange: ProjectsBoardHeaderProps["onClientChange"]
  onProjectChange: ProjectsBoardHeaderProps["onProjectChange"]
  onSelectNextProject: ProjectsBoardHeaderProps["onSelectNextProject"]
  onSelectPreviousProject: ProjectsBoardHeaderProps["onSelectPreviousProject"]
  canSelectNextProject: ProjectsBoardHeaderProps["canSelectNext"]
  canSelectPreviousProject: ProjectsBoardHeaderProps["canSelectPrevious"]
}

export function buildProjectsBoardHeader({
  clientItems,
  projectItems,
  selectedClientId,
  selectedProjectId,
  onClientChange,
  onProjectChange,
  onSelectNextProject,
  onSelectPreviousProject,
  canSelectNextProject,
  canSelectPreviousProject,
}: BuildHeaderArgs): ProjectsBoardHeaderProps {
  return {
    clientItems,
    projectItems,
    selectedClientId,
    selectedProjectId,
    onClientChange,
    onProjectChange,
    onSelectNextProject,
    onSelectPreviousProject,
    canSelectNext: canSelectNextProject,
    canSelectPrevious: canSelectPreviousProject,
  }
}

