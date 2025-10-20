'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { KanbanSquare, Users2, Building2, FolderKanban, Clock3 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/auth/session";

type NavGroup = {
  title: string;
  roles: UserRole[];
  items: Array<{
    href: string;
    label: string;
    icon: LucideIcon;
  }>;
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Workspace",
    roles: ["ADMIN", "CONTRACTOR", "CLIENT"],
    items: [
      {
        href: "/projects",
        label: "Projects",
        icon: KanbanSquare,
      },
    ],
  },
  {
    title: "Admin",
    roles: ["ADMIN"],
    items: [
      {
        href: "/settings/users",
        label: "Users",
        icon: Users2,
      },
      {
        href: "/settings/clients",
        label: "Clients",
        icon: Building2,
      },
      {
        href: "/settings/projects",
        label: "Projects",
        icon: FolderKanban,
      },
      {
        href: "/settings/hour-blocks",
        label: "Hour Blocks",
        icon: Clock3,
      },
    ],
  },
];

type Props = {
  role: UserRole;
};

export function Sidebar({ role }: Props) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 border-r bg-background/90 px-6 py-8 md:block">
      <div className="space-y-10">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Place to Stand
          </span>
          <p className="mt-2 text-base font-semibold">Portal</p>
        </div>
        <nav className="space-y-10">
          {NAV_GROUPS.filter((group) => group.roles.includes(role)).map(
            (group) => (
              <div key={group.title} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href || pathname.startsWith(item.href + "/");

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </nav>
      </div>
    </aside>
  );
}
