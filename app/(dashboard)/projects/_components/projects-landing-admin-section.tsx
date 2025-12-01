'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { ProjectSheet } from '@/app/(dashboard)/settings/projects/project-sheet'
import { useProjectsSettingsController } from '@/components/settings/projects/table/use-projects-settings-controller'
import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { useToast } from '@/components/ui/use-toast'
import { sortClientsByName } from '@/lib/settings/projects/project-sheet-form'
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'
import type { ProjectWithRelations } from '@/lib/types'

import { ProjectsLanding } from './projects-landing'
import { ProjectsTabsNav } from './projects-tabs-nav'

export type ProjectsLandingAdminSectionProps = {
  projects: ProjectWithRelations[]
  landingClients: Array<{ id: string; name: string; slug: string | null }>
  clients: ClientRow[]
  currentUserId: string
}

export function ProjectsLandingAdminSection({
  projects,
  landingClients,
  clients,
  currentUserId,
}: ProjectsLandingAdminSectionProps) {
  const router = useRouter()
  const { toast } = useToast()
  const sortedClients = useMemo(() => sortClientsByName(clients), [clients])

  const {
    sheetOpen,
    selectedProject,
    handleSheetOpenChange,
    handleSheetComplete,
    openCreate,
  } = useProjectsSettingsController({
    toast,
    onRefresh: () => router.refresh(),
  })

  const createDisabled = sortedClients.length === 0
  const createDisabledReason = createDisabled
    ? "Add a client before creating a project."
    : null
  const visibleProjectCount = useMemo(() => {
    return projects.filter(project => {
      if (project.deleted_at) {
        return false
      }
      if (project.type === 'PERSONAL') {
        return project.created_by === currentUserId
      }
      return true
    }).length
  }, [projects, currentUserId])
  const totalProjectsLabel = useMemo(() => {
    return String(visibleProjectCount)
  }, [visibleProjectCount])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <ProjectsTabsNav activeTab="projects" className="flex-1 sm:flex-none" />
        <div className="ml-auto flex items-center gap-6">
          <span className="text-muted-foreground whitespace-nowrap text-sm">
            Total projects: {totalProjectsLabel}
          </span>
          <DisabledFieldTooltip
            disabled={createDisabled}
            reason={createDisabledReason}
          >
            <Button
              type="button"
              size='sm'
              onClick={openCreate}
              disabled={createDisabled}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add project
            </Button>
          </DisabledFieldTooltip>
        </div>
      </div>
      <ProjectsLanding
        projects={projects}
        clients={landingClients}
        currentUserId={currentUserId}
      />
      <ProjectSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleSheetComplete}
        project={selectedProject}
        clients={sortedClients}
        contractorDirectory={[]}
        projectContractors={{}}
      />
    </div>
  )
}
