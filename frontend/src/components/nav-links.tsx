"use client";

import { CheckSquare, FolderOpen, Lock, Repeat, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/format";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof CheckSquare;
  /** When set, this entry is active only if ?scope= matches. */
  scope?: "mine" | "personal";
  /** Mine and Personal stay off the phone tab bar: the Tasks page has capsules for them. */
  mobile?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/tasks", label: "Tasks", icon: CheckSquare, mobile: true },
  { href: "/tasks?scope=mine", label: "Mine", icon: User, scope: "mine", mobile: false },
  { href: "/tasks?scope=personal", label: "Personal", icon: Lock, scope: "personal", mobile: false },
  { href: "/recurring", label: "Recurring", icon: Repeat, mobile: true },
  { href: "/projects", label: "Projects", icon: FolderOpen, mobile: true },
  { href: "/team", label: "Team", icon: Users, mobile: true },
];

/** Shared active-state logic for both the sidebar and the mobile tab bar. */
function useIsActive() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope");

  return (item: NavItem) => {
    const base = item.href.split("?")[0]!;
    if (pathname !== base && !pathname.startsWith(`${base}/`)) return false;
    if (base !== "/tasks") return true;
    return item.scope ? scope === item.scope : !scope || scope === "all";
  };
}

export function SidebarNav() {
  const isActive = useIsActive();

  return (
    <>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={cn(
            "flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-sm transition-colors",
            isActive(item) ? "bg-raised font-medium text-ink" : "text-ink-soft hover:bg-raised/70",
          )}
        >
          <item.icon className="size-4 text-ink-muted" />
          {item.label}
        </Link>
      ))}
    </>
  );
}

export function MobileNav() {
  const isActive = useIsActive();

  return (
    <>
      {NAV_ITEMS.filter((item) => item.mobile).map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px]",
            isActive(item) ? "text-signal" : "text-ink-muted",
          )}
        >
          <item.icon className="size-5" />
          {item.label}
        </Link>
      ))}
    </>
  );
}
