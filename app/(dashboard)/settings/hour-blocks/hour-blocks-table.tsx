'use client';

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { AlarmClock, FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";

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

import { cn } from "@/lib/utils";
import { getHourBlockTypeLabel } from "@/lib/constants";

import { HourBlockSheet } from "./hour-block-sheet";
import { softDeleteHourBlock } from "./actions";

type HourBlockRow = Database["public"]["Tables"]["hour_blocks"]["Row"];
type ProjectRow = Pick<Database["public"]["Tables"]["projects"]["Row"], "id" | "name" | "deleted_at">;

type HourBlockWithProject = HourBlockRow & { project: ProjectRow | null };

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
      [...hourBlocks].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      ),
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
          description: `${block.title} will be hidden from active tracking but remains available historically.`,
        });
        router.refresh();
      } finally {
        setPendingDeleteId(null);
      }
    });
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    return format(new Date(value), "MMM d, yyyy");
  };

  const formatRange = (start?: string | null, end?: string | null) => {
    if (!start && !end) return "—";
    const startText = start ? formatDate(start) : "TBD";
    const endText = end ? formatDate(end) : "TBD";
    if (startText === endText) {
      return startText;
    }
    return `${startText} – ${endText}`;
  };

  const formatStatus = (block: HourBlockWithProject) => {
    if (block.deleted_at) return "Archived";
    if (block.hours_consumed >= block.hours_purchased) return "Depleted";
    return "Active";
  };

  const toHours = (value: number) => `${value.toLocaleString()}h`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold">Hour Blocks</h2>
          <p className="text-sm text-muted-foreground">
            Track purchased time allocations per project and keep an eye on remaining hours.
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
              <TableHead>Title</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Purchased</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedBlocks.map((block) => {
              const project = block.project;
              const remaining = Math.max(block.hours_purchased - block.hours_consumed, 0);
              const deleting = isPending && pendingDeleteId === block.id;
              const deleteDisabled = deleting || Boolean(block.deleted_at);

              return (
                <TableRow
                  key={block.id}
                  className={cn(block.deleted_at ? "opacity-60" : undefined)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <AlarmClock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{block.title}</span>
                    </div>
                    {block.notes ? (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {block.notes}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      <span>{project ? project.name : "Unassigned"}</span>
                    </div>
                    {project?.deleted_at ? (
                      <p className="text-xs text-destructive">Project archived</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getHourBlockTypeLabel(block.block_type)}
                  </TableCell>
                  <TableCell className="text-sm">{toHours(block.hours_purchased)}</TableCell>
                  <TableCell className="text-sm">{toHours(remaining)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRange(block.starts_on, block.ends_on)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        block.deleted_at
                          ? "text-xs font-medium text-destructive"
                          : remaining === 0
                            ? "text-xs font-medium text-amber-600"
                            : "text-xs font-medium text-emerald-600"
                      }
                    >
                      {formatStatus(block)}
                    </span>
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
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
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
