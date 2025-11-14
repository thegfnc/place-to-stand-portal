'use client'

import { AppShellHeader } from '@/components/layout/app-shell'
import { ProjectsBoardEmpty } from './_components/projects-board-empty'
import { ProjectsBoardHeader } from './_components/projects-board-header'
import { ProjectBurndownWidget } from './_components/project-burndown-widget'
import { ProjectsBoardTabsSection } from './_components/projects-board/projects-board-tabs-section'
import { ProjectsBoardDialogs } from './_components/projects-board-dialogs'
import {
  useProjectsBoardViewModel,
  type ProjectsBoardProps,
} from './_hooks/use-projects-board-view-model'

export function ProjectsBoard(props: ProjectsBoardProps) {
  const viewModel = useProjectsBoardViewModel(props)

  if (viewModel.isEmpty) {
    return (
      <>
        <AppShellHeader>
          <ProjectsBoardHeader {...viewModel.header} />
        </AppShellHeader>
        <div className='flex h-full flex-col gap-6'>
          <ProjectsBoardEmpty
            title={viewModel.emptyState.title}
            description={viewModel.emptyState.description}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <AppShellHeader>
        <div className='flex justify-between'>
          <ProjectsBoardHeader {...viewModel.header} />
          <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6'>
            {viewModel.burndown.visible ? (
              <ProjectBurndownWidget
                totalClientRemainingHours={
                  viewModel.burndown.totalClientRemainingHours
                }
                totalProjectLoggedHours={
                  viewModel.burndown.totalProjectLoggedHours
                }
                className='ml-auto w-full sm:w-auto'
                canLogTime={viewModel.burndown.canLogTime}
                addTimeLogDisabledReason={
                  viewModel.burndown.addTimeLogDisabledReason
                }
                viewTimeLogsHref={viewModel.burndown.viewTimeLogsHref}
                onAddTimeLog={viewModel.burndown.onAddTimeLog}
              />
            ) : null}
          </div>
        </div>
      </AppShellHeader>
      <div className='flex h-full min-h-0 flex-col gap-4 sm:gap-6'>
        <ProjectsBoardTabsSection {...viewModel.tabs} />
        <ProjectsBoardDialogs {...viewModel.dialogs} />
      </div>
    </>
  )
}
