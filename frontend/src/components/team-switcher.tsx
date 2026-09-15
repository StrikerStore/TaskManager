"use client";

import { Check, ChevronDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTeam } from "@/components/team-context";
import { cn } from "@/lib/format";

export function TeamSwitcher({ compact = false }: { compact?: boolean }) {
  const { teams, team, setTeamId } = useTeam();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-[8px] border border-rule-strong bg-raised text-ink transition-colors hover:bg-sunken",
          compact ? "h-8 max-w-[10rem] px-2 text-[13px]" : "h-9 w-full px-2.5 text-sm",
        )}
      >
        <span className="truncate font-medium">{team?.name ?? "Select team"}</span>
        <ChevronDown className="ml-auto size-3.5 shrink-0 text-ink-muted" />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-[10px] border border-rule-strong bg-raised shadow-[var(--shadow-sheet)] right-0 md:left-0">
          <ul className="max-h-64 overflow-y-auto py-1">
            {teams.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    setTeamId(t.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-sunken"
                >
                  <span className="flex-1 truncate">{t.name}</span>
                  {t.id === team?.id && <Check className="size-4 text-signal" />}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/onboarding");
            }}
            className="flex w-full items-center gap-2 border-t border-rule px-3 py-2 text-left text-sm text-ink-soft hover:bg-sunken"
          >
            <Plus className="size-4" />
            New team
          </button>
        </div>
      )}
    </div>
  );
}
