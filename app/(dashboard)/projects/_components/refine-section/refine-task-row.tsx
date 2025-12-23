"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { MessageCircle, Paperclip } from "lucide-react"

import {
  TableCell,
  TableRow,
} from "@/components/ui/table"
import type { BoardColumnId } from "@/lib/projects/board/board-constants"
import { cn } from "@/lib/utils"
import type { TaskWithRelations } from "@/lib/types"

import { formatDueDate, formatUpdatedAt } from "./refine-formatters"

type AssigneeInfo = { id: string; name: string; avatarUrl: string | null }

export type RefineTaskRowProps = {
  task: TaskWithRelations
  assignees: AssigneeInfo[]
  onEdit: (task: TaskWithRelations) => void
  draggable: boolean
  isActive?: boolean
  columnId: BoardColumnId
}

export function RefineTaskRow({
  task,
  assignees,
  onEdit,
  draggable,
  isActive = false,
  columnId,
}: RefineTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !draggable,
    data: {
      type: "task",
      taskId: task.id,
      projectId: task.project_id,
      columnId,
    },
  })

  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const cleanedAttributes = useMemo(() => {
    if (!attributes) {
      return {}
    }

    const { ["aria-describedby"]: _omitDescribedBy, ...rest } = attributes
    void _omitDescribedBy
    return rest
  }, [attributes])

  const style: CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition: isDragging ? undefined : transition,
  }

  const assignedSummary = assignees.length
    ? assignees.map((person) => person.name).join(", ")
    : "Unassigned"
  const commentCount = task.commentCount ?? 0
  const attachmentCount =
    task.attachmentCount ?? task.attachments?.length ?? 0

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        onEdit(task)
      }
    },
    [onEdit, task]
  )

  const tableAttributes = isMounted ? attributes : cleanedAttributes

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      {...tableAttributes}
      {...listeners}
      data-state={isActive ? "selected" : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => onEdit(task)}
      className={cn(
        "group focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging && "ring-primary ring-2",
        (isActive || isDragging) && "bg-primary/5",
        !isActive && !isDragging && "hover:bg-muted/50"
      )}
    >
      <TableCell className="py-3 align-top">
        <div className="flex flex-col gap-1">
          <span className="text-sm leading-snug font-medium">{task.title}</span>
          <span className="text-muted-foreground text-xs">
            {assignedSummary}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground py-3 text-center text-xs">
        {commentCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {commentCount}
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-muted-foreground py-3 text-center text-xs">
        {attachmentCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Paperclip className="h-3.5 w-3.5" />
            {attachmentCount}
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-muted-foreground py-3 text-sm">
        {formatDueDate(task.due_on ?? null)}
      </TableCell>
      <TableCell className="text-muted-foreground py-3 text-sm">
        {formatUpdatedAt(task.updated_at)}
      </TableCell>
    </TableRow>
  )
}

