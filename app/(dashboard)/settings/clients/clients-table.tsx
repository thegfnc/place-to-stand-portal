'use client';

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Building2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Database } from "@/supabase/types/database";

import { ClientSheet } from "@/app/(dashboard)/settings/clients/clients-sheet";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"] & {
  projects?: Array<{ id: string; deleted_at: string | null }> | null;
};

type Props = {
  clients: ClientRow[];
};

export function ClientsSettingsTable({ clients }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
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
          <Plus className="mr-2 h-4 w-4" /> Add client
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
              <TableHead>Updated</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedClients.map((client) => {
              const activeProjects = client.projects?.filter((project) => !project.deleted_at).length ?? 0;
              const statusLabel = client.deleted_at ? "Archived" : "Active";
              const updatedAt = client.updated_at
                ? format(new Date(client.updated_at), "MMM d, yyyy")
                : "—";

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
                  <TableCell className="text-sm text-muted-foreground">{updatedAt}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openEdit(client)}
                      title="Edit client"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {sortedClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
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
