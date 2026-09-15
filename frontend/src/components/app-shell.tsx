"use client";

import { useQuery } from "@tanstack/react-query";
import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { MobileNav, SidebarNav } from "@/components/nav-links";
import { useTeam } from "@/components/team-context";
import { TeamSwitcher } from "@/components/team-switcher";
import { Avatar, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { authClient, useSession, usernameOf } from "@/lib/auth-client";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { teams, teamId, loading } = useTeam();
  const [signingOut, setSigningOut] = useState(false);

  // Gate the whole app: no session -> login, no team -> onboarding.
  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    if (!loading && teams.length === 0) router.replace("/onboarding");
  }, [isPending, session, loading, teams.length, router]);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", teamId],
    queryFn: () => api.listProjects(teamId!),
    enabled: Boolean(teamId),
  });

  if (isPending || !session?.user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Loading…</p>
      </div>
    );
  }

  const username = usernameOf(session.user);

  const handleSignOut = async () => {
    setSigningOut(true);
    await authClient.signOut();
    router.replace("/login");
  };

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* ---------------------------------------------------- desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-rule bg-sunken/60 md:flex">
        <div className="border-b border-rule px-4 py-4">
          <Link href="/tasks" className="font-display text-2xl leading-none tracking-tight">
            Task<span className="italic text-signal">board</span>
          </Link>
        </div>

        <div className="border-b border-rule p-3">
          <TeamSwitcher />
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <Suspense fallback={null}>
            <SidebarNav />
          </Suspense>

          <p className="mt-5 mb-1.5 px-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            Projects
          </p>
          {projects.length === 0 && (
            <p className="px-2.5 py-1 text-[13px] text-ink-muted">No projects yet</p>
          )}
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/tasks?projectIds=${project.id}`}
              className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-[13px] text-ink-soft transition-colors hover:bg-raised/70"
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: project.color }}
              />
              <span className="flex-1 truncate">{project.name}</span>
              {project.openCount > 0 && (
                <span className="font-mono text-[11px] text-ink-muted">{project.openCount}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 border-t border-rule p-3">
          <Link
            href="/account"
            title="Account and passcode"
            className="-m-1 flex min-w-0 flex-1 items-center gap-2 rounded-[8px] p-1 transition-colors hover:bg-raised/70"
          >
            <Avatar name={session.user.name} image={session.user.image} size={28} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{session.user.name}</p>
              <p className="truncate font-mono text-[11px] text-ink-muted">{username ? `@${username}` : ""}</p>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>

      {/* ------------------------------------------------------- mobile header */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-rule bg-paper/95 px-3 py-2 backdrop-blur md:hidden">
        <Link href="/tasks" className="font-display text-xl leading-none">
          Task<span className="italic text-signal">board</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <TeamSwitcher compact />
          <Link
            href="/account"
            aria-label="Account"
            className="inline-flex h-8 items-center justify-center rounded-[8px] px-2.5 text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <UserRound className="size-4" />
          </Link>
          <Button variant="ghost" size="sm" onClick={handleSignOut} aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <main className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">{children}</main>

      {/* ----------------------------------------------------- mobile tab bar */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-rule bg-paper/95 backdrop-blur md:hidden">
        <Suspense fallback={null}>
          <MobileNav />
        </Suspense>
      </nav>
    </div>
  );
}
