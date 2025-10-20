'use client';

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ProjectWithRelations, TaskWithRelations } from "@/lib/types";
import type { UserRole } from "@/lib/auth/session";

import { changeTaskStatus } from "./actions";
import { TaskCard, TaskCardPreview } from "./task-card";
import { TaskSheet } from "./task-sheet";

const BOARD_COLUMNS = [
  { id: "BACKLOG", label: "Backlog" },
  { id: "ON_DECK", label: "On Deck" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "IN_REVIEW", label: "In Review" },
  { id: "BLOCKED", label: "Blocked" },
  { id: "DONE", label: "Done" },
  { id: "ARCHIVED", label: "Archived" },
] as const;

type BoardColumnId = (typeof BOARD_COLUMNS)[number]["id"];

type Props = {
  projects: ProjectWithRelations[];
  clients: Array<{ id: string; name: string }>;
  currentUserId: string;
  currentUserRole: UserRole;
};

export function ProjectsBoard({ projects, clients, currentUserId, currentUserRole }: Props) {
  const [selectedClientId, setSelectedClientId] = useState<string>(() => {
    if (clients.length === 1) {
      return clients[0].id;
    }
    return "all";
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => projects[0]?.id ?? null
  );
  const [isPending, startTransition] = useTransition();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetTask, setSheetTask] = useState<TaskWithRelations | undefined>();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const filteredProjects = useMemo(() => {
    if (selectedClientId === "all") {
      return projects;
    }

    return projects.filter((project) => project.client_id === selectedClientId);
  }, [projects, selectedClientId]);

  useEffect(() => {
    if (filteredProjects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    if (!selectedProjectId || !filteredProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(filteredProjects[0]?.id ?? null);
    }
  }, [filteredProjects, selectedProjectId]);

  const activeProject = filteredProjects.find((project) => project.id === selectedProjectId) ?? null;
  const canManageTasks = useMemo(() => {
    if (!activeProject) return false;
    if (currentUserRole === "ADMIN") return true;

    return activeProject.members.some(
      (member) => member.user_id === currentUserId && member.role !== "VIEWER"
    );
  }, [activeProject, currentUserId, currentUserRole]);

  const memberDirectory = useMemo(() => {
    if (!activeProject) return new Map<string, { name: string }>();
    return new Map(
      activeProject.members.map((member) => [
        member.user_id,
        { name: member.user.full_name ?? member.user.email },
      ])
    );
  }, [activeProject]);

  const tasksByColumn = useMemo(() => {
    const map = new Map<BoardColumnId, TaskWithRelations[]>();

    BOARD_COLUMNS.forEach((column) => {
      map.set(column.id, []);
    });

    if (!activeProject) {
      return map;
    }

    [...activeProject.tasks]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .forEach((task) => {
        if (!map.has(task.status as BoardColumnId)) {
          map.set(task.status as BoardColumnId, []);
        }

        map.get(task.status as BoardColumnId)!.push(task);
      });

    return map;
  }, [activeProject]);

  const activeTask = activeProject?.tasks.find((task) => task.id === activeTaskId) ?? null;

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = String(event.active.id);
    setActiveTaskId(taskId);
  };

  const handleDragOver = () => {
    // Not implementing intra-column ordering in Phase 1.
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null);

    if (!canManageTasks || !activeProject) {
      return;
    }

    const { active, over } = event;

    if (!over) {
      return;
    }

    const destinationStatus = over.id as BoardColumnId;
    const task = activeProject.tasks.find((item) => item.id === active.id);

    if (!task || task.status === destinationStatus) {
      return;
    }

    startTransition(async () => {
      setFeedback(null);
      const result = await changeTaskStatus({
        taskId: task.id,
        status: destinationStatus,
      });

      if (result.error) {
        setFeedback(result.error);
      }
    });
  };

  const openCreateSheet = () => {
    setSheetTask(undefined);
    setIsSheetOpen(true);
  };

  const handleEditTask = (task: TaskWithRelations) => {
    setSheetTask(task);
    setIsSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open);
    if (!open) {
      setSheetTask(undefined);
    }
  };

  const renderAssignees = (task: TaskWithRelations) => {
    return task.assignees
      .map((assignee) => ({
        id: assignee.user_id,
        name: memberDirectory.get(assignee.user_id)?.name ?? "Unknown",
      }))
      .filter((assignee, index, array) => array.findIndex((item) => item.id === assignee.id) === index);
  };

  if (projects.length === 0) {
    return (
      <div className="grid h-full w-full place-items-center rounded-xl border border-dashed p-12 text-center">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">No projects assigned yet</h2>
          <p className="text-sm text-muted-foreground">
            Once an administrator links you to a project, the workspace will unlock here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold tracking-tight">Project board</h1>
          <p className="text-sm text-muted-foreground">
            Drag tasks between columns to update status. Filters respect your project assignments.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedProjectId ?? ""}
            onValueChange={(value) => setSelectedProjectId(value || null)}
            disabled={filteredProjects.length === 0}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {filteredProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreateSheet} disabled={!activeProject || !canManageTasks}>
            <Plus className="mr-2 h-4 w-4" /> Add task
          </Button>
        </div>
      </div>
      {feedback ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {feedback}
        </p>
      ) : null}
      {!activeProject ? (
        <div className="grid h-full w-full place-items-center rounded-xl border border-dashed p-12 text-center">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">No project selected</h2>
            <p className="text-sm text-muted-foreground">
              Choose a client and project above to view the associated tasks.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative flex-1">
          <div className="absolute inset-0 overflow-hidden">
            <div className="h-full overflow-x-auto pb-6">
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <div className="flex min-h-full w-max gap-4 pr-6">
                  {BOARD_COLUMNS.map((column) => (
                    <KanbanColumn
                      key={column.id}
                      columnId={column.id}
                      label={column.label}
                      tasks={tasksByColumn.get(column.id as BoardColumnId) ?? []}
                      renderAssignees={renderAssignees}
                      onEditTask={handleEditTask}
                      canManage={canManageTasks}
                    />
                  ))}
                </div>
                <DragOverlay dropAnimation={null}>
                  {activeTask ? (
                    <TaskCardPreview
                      task={activeTask}
                      assignees={renderAssignees(activeTask)}
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </div>
          {isPending ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : null}
        </div>
      )}
      {activeProject ? (
        <TaskSheet
          open={isSheetOpen}
          onOpenChange={handleSheetOpenChange}
          project={activeProject}
          task={sheetTask}
          canManage={canManageTasks}
        />
      ) : null}
    </div>
  );
}

type KanbanColumnProps = {
  columnId: BoardColumnId;
  label: string;
  tasks: TaskWithRelations[];
  canManage: boolean;
  renderAssignees: (task: TaskWithRelations) => Array<{ id: string; name: string }>;
  onEditTask: (task: TaskWithRelations) => void;
};

function KanbanColumn({
  columnId,
  label,
  tasks,
  canManage,
  renderAssignees,
  onEditTask,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-80 flex-shrink-0 flex-col gap-4 rounded-xl border bg-background/80 p-4 shadow-sm transition",
        isOver && "ring-2 ring-primary"
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            assignees={renderAssignees(task)}
            onEdit={onEditTask}
            draggable={canManage}
          />
        ))}
      </div>
    </div>
  );
}
