import { useCallback, useState } from 'react'

import type { ProjectWithRelations } from '@/lib/types'

type UseBoardTimeLogDialogsOptions = {
  activeProject: ProjectWithRelations | null
  canLogTime: boolean
}

type UseBoardTimeLogDialogsReturn = {
  isTimeLogDialogOpen: boolean
  timeLogProjectId: string | null
  handleTimeLogDialogOpenChange: (open: boolean) => void
  isViewTimeLogsOpen: boolean
  viewTimeLogsProjectId: string | null
  handleViewTimeLogsDialogOpenChange: (open: boolean) => void
}

export function useBoardTimeLogDialogs(
  options: UseBoardTimeLogDialogsOptions
): UseBoardTimeLogDialogsReturn {
  const { activeProject, canLogTime } = options
  const [isTimeLogDialogOpen, setIsTimeLogDialogOpen] = useState(false)
  const [timeLogProjectId, setTimeLogProjectId] = useState<string | null>(null)
  const [isViewTimeLogsOpen, setIsViewTimeLogsOpen] = useState(false)
  const [viewTimeLogsProjectId, setViewTimeLogsProjectId] = useState<
    string | null
  >(null)

  const handleTimeLogDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setIsTimeLogDialogOpen(false)
        setTimeLogProjectId(null)
        return
      }

      if (!canLogTime) {
        setIsTimeLogDialogOpen(false)
        setTimeLogProjectId(null)
        return
      }

      if (!activeProject) {
        setIsTimeLogDialogOpen(false)
        setTimeLogProjectId(null)
        return
      }

      setTimeLogProjectId(activeProject.id)
      setIsTimeLogDialogOpen(true)
    },
    [activeProject, canLogTime]
  )

  const handleViewTimeLogsDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setIsViewTimeLogsOpen(false)
        setViewTimeLogsProjectId(null)
        return
      }

      if (!activeProject) {
        setIsViewTimeLogsOpen(false)
        setViewTimeLogsProjectId(null)
        return
      }

      setViewTimeLogsProjectId(activeProject.id)
      setIsViewTimeLogsOpen(true)
    },
    [activeProject]
  )

  return {
    isTimeLogDialogOpen,
    timeLogProjectId,
    handleTimeLogDialogOpenChange,
    isViewTimeLogsOpen,
    viewTimeLogsProjectId,
    handleViewTimeLogsDialogOpenChange,
  }
}
