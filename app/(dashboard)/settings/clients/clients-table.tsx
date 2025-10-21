'use client';

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import type { Database } from "@/supabase/types/database";

import { ClientSheet } from "@/app/(dashboard)/settings/clients/clients-sheet";
import { softDeleteClient } from "./actions";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"] & {
  projects?: Array<{ id: string; deleted_at: string | null }> | null;
};

type Props = {
  clients: ClientRow[];
};

export function ClientsSettingsTable({ clients }: Props) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const sortedClients = useMemo(
    () =>
      clients
        .filter((client) => !client.deleted_at)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [clients]
  );

  const openCreate = () => {
    setSelectedClient(null);
    setSheetOpen(true);
  };

  const openEdit = (client: ClientRow) => {
    setSelectedClient(client);
    setSheetOpen(true);
  };

  const handleClosed = () => {
    setSheetOpen(false);
  };

  const handleDelete = (client: ClientRow) => {
    if (client.deleted_at) {
      return;
    }

    const confirmed = window.confirm(
      "Deleting this client hides it from selectors and reporting. Existing projects stay linked."
    );

    if (!confirmed) {
      return;
    }

    setPendingDeleteId(client.id);
    startTransition(async () => {
      try {
        const result = await softDeleteClient({ id: client.id });

        if (result.error) {
          toast({
            title: "Unable to delete client",
            description: result.error,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Client deleted",
          description: `${client.name} is hidden from selectors but remains available for history.`,
        });
        router.refresh();
      } finally {
        setPendingDeleteId(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Clients</h2>
          <p className="text-sm text-muted-foreground">
            Track active organizations and control which projects roll up to each client.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add client
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Active projects</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedClients.map((client) => {
              const activeProjects = client.projects?.filter((project) => !project.deleted_at).length ?? 0;
              const statusLabel = client.deleted_at ? "Archived" : "Active";
              const deleting = isPending && pendingDeleteId === client.id;
              const deleteDisabled = deleting || Boolean(client.deleted_at);

              return (
                <TableRow key={client.id} className={client.deleted_at ? "opacity-60" : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{client.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {client.slug ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{activeProjects}</TableCell>
                  <TableCell>
                    <span
                      className={client.deleted_at ? "text-xs font-medium text-destructive" : "text-xs font-medium text-emerald-600"}
                    >
                      {statusLabel}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openEdit(client)}
                        title="Edit client"
                        disabled={deleting}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(client)}
                        title={deleteDisabled ? "Client already deleted" : "Delete client"}
                        aria-label="Delete client"
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
            {sortedClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No clients yet. Create one to begin organizing projects.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <ClientSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComplete={handleClosed}
        client={selectedClient}
      />
    </div>
  );
}
