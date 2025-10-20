'use client';

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Building2, FolderKanban, Pencil, Plus } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Database } from "@/supabase/types/database";

import { cn } from "@/lib/utils";
import { getProjectStatusLabel } from "@/lib/constants";

import { ProjectSheet } from "./project-sheet";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ClientRow = Pick<Database["public"]["Tables"]["clients"]["Row"], "id" | "name" | "deleted_at">;

type ProjectWithClient = ProjectRow & { client: ClientRow | null };

type Props = {
  projects: ProjectWithClient[];
  clients: ClientRow[];
};

export function ProjectsSettingsTable({ projects, clients }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithClient | null>(null);

  const sortedProjects = useMemo(
    () =>
      [...projects].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
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

  const formatRange = (start?: string | null, end?: string | null) => {
    if (!start && !end) return "—";

    const formattedStart = start ? format(new Date(start), "MMM d, yyyy") : "TBD";
    const formattedEnd = end ? format(new Date(end), "MMM d, yyyy") : "TBD";

    if (formattedStart === formattedEnd) {
      return formattedStart;
    }

    return `${formattedStart} – ${formattedEnd}`;
  };

  const formatStatus = (project: ProjectWithClient) => {
    if (project.deleted_at) return "Archived";
    return getProjectStatusLabel(project.status);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Review every project, including archived work, with quick insight into timing and client.
          </p>
        </div>
        {createDisabledReason ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button className="ml-auto" onClick={openCreate} disabled={createDisabled}>
                <Plus className="mr-2 h-4 w-4" /> Add project
              </Button>
            </TooltipTrigger>
            <TooltipContent>{createDisabledReason}</TooltipContent>
          </Tooltip>
        ) : (
          <Button className="ml-auto" onClick={openCreate} disabled={createDisabled}>
            <Plus className="mr-2 h-4 w-4" /> Add project
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
              <TableHead>Code</TableHead>
              <TableHead>Timeline</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProjects.map((project) => {
              const client = project.client;
              const updatedAt = project.updated_at
                ? format(new Date(project.updated_at), "MMM d, yyyy")
                : "—";

              return (
                <TableRow
                  key={project.id}
                  className={cn(project.deleted_at ? "opacity-60" : undefined)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{project.name}</span>
                    </div>
                    {project.description ? (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {project.description}
                      </p>
                    ) : null}
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
                    <span
                      className={
                        project.deleted_at
                          ? "text-xs font-medium text-destructive"
                          : "text-xs font-medium text-emerald-600"
                      }
                    >
                      {formatStatus(project)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {project.code ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRange(project.starts_on, project.ends_on)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{updatedAt}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openEdit(project)}
                      title="Edit project"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {sortedProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
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
