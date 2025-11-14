"use client"

import { Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { BoardColumnId } from "@/lib/projects/board/board-constants"
import { cn } from "@/lib/utils"
import {
  getTaskStatusLabel,
  getTaskStatusToken,
} from "@/lib/projects/task-status"

type RefineSectionHeaderProps = {
  status: BoardColumnId
  label: string
  taskCount: number
  description: string
  canManage: boolean
  onCreateTask?: (status: BoardColumnId) => void
}

export function RefineSectionHeader({
  status,
  label,
  taskCount,
  description,
  canManage,
  onCreateTask,
}: RefineSectionHeaderProps) {
  const statusToken = getTaskStatusToken(status)
  const statusLabel = getTaskStatusLabel(status)
  const displayLabel = label || statusLabel

  return (
    <div className="border-b px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn("text-sm font-semibold uppercase", statusToken)}
            >
              {displayLabel}
            </Badge>
            <span className="text-muted-foreground text-[11px]">
              {taskCount}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
        {canManage && onCreateTask ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 self-start sm:self-auto"
            onClick={() => onCreateTask(status)}
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Add task to {displayLabel}</span>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

