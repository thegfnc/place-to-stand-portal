import { useState, useTransition } from 'react'

import {
  destroyProject,
  restoreProject as restoreProjectAction,
  softDeleteProject,
} from '@/app/(dashboard)/settings/projects/actions'

import type { ProjectWithClient } from './types'

type ToastFn = (props: {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}) => void

type UseProjectsSettingsControllerParams = {
  toast: ToastFn
  onRefresh: () => void
}

type UseProjectsSettingsControllerReturn = {
  sheetOpen: boolean
  selectedProject: ProjectWithClient | null
  deleteTarget: ProjectWithClient | null
  destroyTarget: ProjectWithClient | null
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  isPending: boolean
  openCreate: () => void
  openEdit: (project: ProjectWithClient) => void
  handleSheetOpenChange: (open: boolean) => void
  handleSheetComplete: () => void
  requestDelete: (project: ProjectWithClient) => void
  cancelDelete: () => void
  confirmDelete: () => void
  restoreProject: (project: ProjectWithClient) => void
  requestDestroy: (project: ProjectWithClient) => void
  cancelDestroy: () => void
  confirmDestroy: () => void
}

export function useProjectsSettingsController({
  toast,
  onRefresh,
}: UseProjectsSettingsControllerParams): UseProjectsSettingsControllerReturn {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedProject, setSelectedProject] =
    useState<ProjectWithClient | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithClient | null>(
    null
  )
  const [destroyTarget, setDestroyTarget] = useState<ProjectWithClient | null>(
    null
  )
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const openCreate = () => {
    setSelectedProject(null)
    setSheetOpen(true)
  }

  const openEdit = (project: ProjectWithClient) => {
    setSelectedProject(project)
    setSheetOpen(true)
  }

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open)
    if (!open) {
      setSelectedProject(null)
    }
  }

  const handleSheetComplete = () => {
    setSheetOpen(false)
    setSelectedProject(null)
    onRefresh()
  }

  const requestDelete = (project: ProjectWithClient) => {
    if (project.deleted_at || isPending) {
      return
    }

    setDeleteTarget(project)
  }

  const cancelDelete = () => {
    if (isPending) {
      return
    }

    setDeleteTarget(null)
  }

  const confirmDelete = () => {
    if (!deleteTarget || deleteTarget.deleted_at) {
      setDeleteTarget(null)
      return
    }

    const project = deleteTarget
    setDeleteTarget(null)
    setPendingDeleteId(project.id)

    startTransition(async () => {
      try {
        const result = await softDeleteProject({ id: project.id })

        if (result.error) {
          toast({
            title: 'Unable to delete project',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Project archived',
          description: `${project.name} is hidden from active views but remains in historical reporting.`,
        })
        onRefresh()
      } finally {
        setPendingDeleteId(null)
      }
    })
  }

  const restoreProject = (project: ProjectWithClient) => {
    if (!project.deleted_at || isPending) {
      return
    }

    setPendingRestoreId(project.id)
    startTransition(async () => {
      try {
        const result = await restoreProjectAction({ id: project.id })

        if (result.error) {
          toast({
            title: 'Unable to restore project',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Project restored',
          description: `${project.name} is active again.`,
        })
        onRefresh()
      } finally {
        setPendingRestoreId(null)
      }
    })
  }

  const requestDestroy = (project: ProjectWithClient) => {
    if (!project.deleted_at || isPending) {
      return
    }

    setDestroyTarget(project)
  }

  const cancelDestroy = () => {
    if (isPending) {
      return
    }

    setDestroyTarget(null)
  }

  const confirmDestroy = () => {
    if (!destroyTarget || !destroyTarget.deleted_at) {
      setDestroyTarget(null)
      return
    }

    const project = destroyTarget
    setDestroyTarget(null)
    setPendingDestroyId(project.id)

    startTransition(async () => {
      try {
        const result = await destroyProject({ id: project.id })

        if (result.error) {
          toast({
            title: 'Unable to permanently delete project',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Project permanently deleted',
          description: `${project.name} has been removed.`,
        })
        onRefresh()
      } finally {
        setPendingDestroyId(null)
      }
    })
  }

  return {
    sheetOpen,
    selectedProject,
    deleteTarget,
    destroyTarget,
    pendingDeleteId,
    pendingRestoreId,
    pendingDestroyId,
    isPending,
    openCreate,
    openEdit,
    handleSheetOpenChange,
    handleSheetComplete,
    requestDelete,
    cancelDelete,
    confirmDelete,
    restoreProject,
    requestDestroy,
    cancelDestroy,
    confirmDestroy,
  }
}
