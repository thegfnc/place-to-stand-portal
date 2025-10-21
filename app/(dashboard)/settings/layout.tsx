import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/session";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole("ADMIN");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage people, clients, projects, and purchased hour blocks across the cooperative.
        </p>
      </header>
      <section className="rounded-xl border bg-background p-6 shadow-sm">{children}</section>
    </div>
  );
}
