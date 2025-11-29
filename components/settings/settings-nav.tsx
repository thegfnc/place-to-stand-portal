'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/users", label: "Users" },
  { href: "/settings/hour-blocks", label: "Hour Blocks" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
