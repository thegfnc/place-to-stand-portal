import type { ReactNode } from "react";

import { SettingsNav } from "@/components/settings/settings-nav";
import { requireRole } from "@/lib/auth/session";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole("ADMIN");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage people, clients, projects, and purchased hour blocks across the cooperative.
          </p>
        </div>
        <SettingsNav />
      </header>
      <section className="rounded-xl border bg-background p-6 shadow-sm">{children}</section>
    </div>
  );
}
