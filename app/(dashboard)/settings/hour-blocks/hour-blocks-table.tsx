'use client';

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import type { Database } from "@/supabase/types/database";

import { HourBlockSheet } from "./hour-block-sheet";
import { softDeleteHourBlock } from "./actions";

type HourBlockRow = Database["public"]["Tables"]["hour_blocks"]["Row"];
type ProjectRow = Pick<Database["public"]["Tables"]["projects"]["Row"], "id" | "name" | "deleted_at">;
type ClientRow = Pick<Database["public"]["Tables"]["clients"]["Row"], "id" | "name" | "deleted_at">;

type ProjectWithClient = ProjectRow & { client: ClientRow | null };

type HourBlockWithProject = HourBlockRow & { project: ProjectWithClient | null };

type Props = {
  hourBlocks: HourBlockWithProject[];
  projects: ProjectRow[];
};

export function HourBlocksSettingsTable({ hourBlocks, projects }: Props) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<HourBlockWithProject | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const sortedBlocks = useMemo(
    () =>
      hourBlocks
        .filter((block) => !block.deleted_at)
        .sort((a, b) => {
          const projectNameA = a.project?.name ?? "";
          const projectNameB = b.project?.name ?? "";
          const comparison = projectNameA.localeCompare(projectNameB, undefined, { sensitivity: "base" });

          if (comparison !== 0) {
            return comparison;
          }

          const clientNameA = a.project?.client?.name ?? "";
          const clientNameB = b.project?.client?.name ?? "";
          return clientNameA.localeCompare(clientNameB, undefined, { sensitivity: "base" });
        }),
    [hourBlocks]
  );

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [projects]
  );

  const createDisabled = sortedProjects.length === 0;
  const createDisabledReason = createDisabled
    ? "Create a project before logging hour blocks."
    : null;

  const openCreate = () => {
    setSelectedBlock(null);
    setSheetOpen(true);
  };

  const openEdit = (block: HourBlockWithProject) => {
    setSelectedBlock(block);
    setSheetOpen(true);
  };

  const handleClosed = () => {
    setSheetOpen(false);
  };

  const handleDelete = (block: HourBlockWithProject) => {
    if (block.deleted_at) {
      return;
    }

    const projectName = block.project?.name ?? null;

    const confirmed = window.confirm(
      "Deleting this block hides it from active reporting while keeping historical data intact."
    );

    if (!confirmed) {
      return;
    }

    setPendingDeleteId(block.id);
    startTransition(async () => {
      try {
        const result = await softDeleteHourBlock({ id: block.id });

        if (result.error) {
          toast({
            title: "Unable to delete hour block",
            description: result.error,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Hour block deleted",
          description: projectName
            ? `${projectName} hour block is hidden from active tracking.`
            : "The hour block is hidden from active tracking.",
        });
        router.refresh();
      } finally {
        setPendingDeleteId(null);
      }
    });
  };

  const toHours = (value: number) => `${value.toLocaleString()}h`;
  const formatCreatedOn = (value: string) => {
    try {
      return format(new Date(value), "MMM d, yyyy");
    } catch (error) {
      console.warn("Unable to format hour block created_at", { value, error });
      return "—";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold">Hour Blocks</h2>
          <p className="text-sm text-muted-foreground">
            Track purchased hour blocks by project and client for quick allocation visibility.
          </p>
        </div>
        {createDisabledReason ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button className="ml-auto" onClick={openCreate} disabled={createDisabled}>
                <Plus className="h-4 w-4" /> Add hour block
              </Button>
            </TooltipTrigger>
            <TooltipContent>{createDisabledReason}</TooltipContent>
          </Tooltip>
        ) : (
          <Button className="ml-auto" onClick={openCreate} disabled={createDisabled}>
            <Plus className="h-4 w-4" /> Add hour block
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Hours Purchased</TableHead>
              <TableHead>Created On</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedBlocks.map((block) => {
              const project = block.project;
              const deleting = isPending && pendingDeleteId === block.id;
              const deleteDisabled = deleting || Boolean(block.deleted_at);
              const client = project?.client;
              const invoiceNumber = block.invoice_number && block.invoice_number.length > 0 ? block.invoice_number : "—";

              return (
                <TableRow key={block.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      <span>{project ? project.name : "Unassigned"}</span>
                    </div>
                    {project?.deleted_at ? (
                      <p className="text-xs text-destructive">Project archived</p>
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
                  <TableCell className="text-sm text-muted-foreground">{invoiceNumber}</TableCell>
                  <TableCell className="text-sm">{toHours(block.hours_purchased)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatCreatedOn(block.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openEdit(block)}
                        title="Edit hour block"
                        disabled={deleting}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(block)}
                        title={deleteDisabled ? "Hour block already deleted" : "Delete hour block"}
                        aria-label="Delete hour block"
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
            {sortedBlocks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No hour blocks recorded yet. Log a retainer or project block to monitor it here.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <HourBlockSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComplete={handleClosed}
        hourBlock={selectedBlock}
        projects={sortedProjects}
      />
    </div>
  );
}
