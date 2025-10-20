import type { ReactNode } from "react";

import type { AppUser } from "@/lib/auth/session";

import { Sidebar } from "./sidebar";
import { UserMenu } from "./user-menu";

interface Props {
  user: AppUser;
  children: ReactNode;
}

export function AppShell({ user, children }: Props) {
  return (
    <div className="flex min-h-screen bg-muted/20">
      <Sidebar role={user.role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-background px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Signed in as
            </p>
            <p className="text-lg font-semibold leading-tight">
              {user.full_name ?? user.email}
            </p>
          </div>
          <UserMenu user={user} />
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
