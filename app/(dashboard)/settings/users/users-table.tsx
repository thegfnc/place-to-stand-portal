'use client';

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Pencil, Shield, UserPlus } from "lucide-react";

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

import { UserSheet } from "@/app/(dashboard)/settings/users/users-sheet";

const ROLE_LABELS: Record<Database["public"]["Enums"]["user_role"], string> = {
  ADMIN: "Admin",
  CONTRACTOR: "Contractor",
  CLIENT: "Client",
};
type UserRow = Database["public"]["Tables"]["users"]["Row"];

type Props = {
  users: UserRow[];
  currentUserId: string;
};

export function UsersSettingsTable({ users, currentUserId }: Props) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [users]
  );

  const handleOpenCreate = () => {
    setSelectedUser(null);
    setSheetOpen(true);
  };

  const handleEdit = (user: UserRow) => {
    setSelectedUser(user);
    setSheetOpen(true);
  };

  const handleClosed = () => {
    setSheetOpen(false);
    void router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Team members</h2>
          <p className="text-sm text-muted-foreground">
            Invite administrators, contractors, and clients to collaborate inside the portal.
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <UserPlus className="mr-2 h-4 w-4" /> Add user
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.map((user) => (
              <TableRow key={user.id} className={user.deleted_at ? "opacity-60" : undefined}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {user.full_name ?? user.email}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell className="text-sm">
                  {ROLE_LABELS[user.role]}
                </TableCell>
                <TableCell>
                  <span
                    className={user.deleted_at ? "text-xs font-medium text-destructive" : "text-xs font-medium text-emerald-600"}
                  >
                    {user.deleted_at ? "Inactive" : "Active"}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(user.created_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleEdit(user)}
                    title="Edit user"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {sortedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No users found. Use the Add user button to invite someone.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <UserSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComplete={handleClosed}
        user={selectedUser}
        currentUserId={currentUserId}
      />
    </div>
  );
}
