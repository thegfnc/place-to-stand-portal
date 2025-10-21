'use client';

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Building2, FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import type { Database } from "@/supabase/types/database";

import { cn } from "@/lib/utils";
import { getProjectStatusLabel, getProjectStatusToken } from "@/lib/constants";

import { ProjectSheet } from "./project-sheet";
import { softDeleteProject } from "./actions";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ClientRow = Pick<Database["public"]["Tables"]["clients"]["Row"], "id" | "name" | "deleted_at">;

type ProjectWithClient = ProjectRow & { client: ClientRow | null };

type Props = {
  projects: ProjectWithClient[];
  clients: ClientRow[];
};

export function ProjectsSettingsTable({ projects, clients }: Props) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithClient | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const sortedProjects = useMemo(
    () =>
      projects
        .filter((project) => !project.deleted_at)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [projects]
  );

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [clients]
  );

  const createDisabled = sortedClients.length === 0;
  const createDisabledReason = createDisabled
    ? "Add a client before creating a project."
    : null;

  const openCreate = () => {
    setSelectedProject(null);
    setSheetOpen(true);
  };

  const openEdit = (project: ProjectWithClient) => {
    setSelectedProject(project);
    setSheetOpen(true);
  };

  const handleClosed = () => {
    setSheetOpen(false);
  };

  const handleDelete = (project: ProjectWithClient) => {
    if (project.deleted_at) {
      return;
    }

    const confirmed = window.confirm(
      "Deleting this project hides it from active views but keeps the history intact."
    );

    if (!confirmed) {
      return;
    }

    setPendingDeleteId(project.id);
    startTransition(async () => {
      try {
        const result = await softDeleteProject({ id: project.id });

        if (result.error) {
          toast({
            title: "Unable to delete project",
            description: result.error,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Project deleted",
          description: `${project.name} is hidden from active views but remains in historical reporting.`,
        });
        router.refresh();
      } finally {
        setPendingDeleteId(null);
      }
    });
  };

  const formatDate = (value?: string | null) => {
    if (!value) return null;

    try {
      const normalized = value.includes("T") ? value : `${value}T00:00:00`;
      // Ensure the stored date renders as the exact day selected, regardless of timezone.
      return format(parseISO(normalized), "MMM d, yyyy");
    } catch (error) {
      console.warn("Unable to format project date", { value, error });
      return null;
    }
  };

  const formatRange = (start?: string | null, end?: string | null) => {
    if (!start && !end) {
      return "—";
    }

    const startLabel = formatDate(start) ?? "TBD";
    const endLabel = formatDate(end) ?? "TBD";

    if (startLabel === endLabel) {
      return startLabel;
    }

    return `${startLabel} – ${endLabel}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Review active projects with quick insight into timing and client.
          </p>
        </div>
        {createDisabledReason ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button className="ml-auto" onClick={openCreate} disabled={createDisabled}>
                <Plus className="h-4 w-4" /> Add project
              </Button>
            </TooltipTrigger>
            <TooltipContent>{createDisabledReason}</TooltipContent>
          </Tooltip>
        ) : (
          <Button className="ml-auto" onClick={openCreate} disabled={createDisabled}>
            <Plus className="h-4 w-4" /> Add project
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Timeline</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProjects.map((project) => {
              const client = project.client;
              const deleting = isPending && pendingDeleteId === project.id;
              const deleteDisabled = deleting;

              return (
                <TableRow key={project.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{project.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{client ? client.name : "Unassigned"}</span>
                    </div>
                    {client?.deleted_at ? (
                      <p className="text-xs text-destructive">Client archived</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-xs", getProjectStatusToken(project.status))}>
                      {getProjectStatusLabel(project.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRange(project.starts_on, project.ends_on)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openEdit(project)}
                        title="Edit project"
                        disabled={deleting}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(project)}
                        title={deleteDisabled ? "Deleting project" : "Delete project"}
                        aria-label="Delete project"
                        disabled={deleteDisabled}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {sortedProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No projects yet. Create one from the Projects view to see it here.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <ProjectSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComplete={handleClosed}
        project={selectedProject}
        clients={sortedClients}
      />
    </div>
  );
}
