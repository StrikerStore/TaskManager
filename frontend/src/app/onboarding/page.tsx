"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Clock, Plus, Ticket, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthFrame } from "@/components/auth-frame";
import { useTeam } from "@/components/team-context";
import { Button, Input, Label } from "@/components/ui";
import { api } from "@/lib/api";
import { authClient, authErrorMessage, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/format";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "team"
  );
}

/** Stored without the dash; shown as "K7QP-4M2X". */
function formatCode(raw: string): string {
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

const STATUS_STYLE = {
  pending: "border-rule-strong text-ink-muted",
  accepted: "border-done/40 bg-done-soft text-done",
  rejected: "border-urgent/30 text-urgent",
} as const;

const STATUS_LABEL = {
  pending: "Waiting for the owner",
  accepted: "Accepted",
  rejected: "Declined",
} as const;

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session, isPending } = useSession();
  const { teams, refreshTeams, setTeamId } = useTeam();

  const [mode, setMode] = useState<"create" | "join">("create");
  const [teamName, setTeamName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPending && !session?.user) router.replace("/login");
  }, [isPending, session, router]);

  const { data: requests = [] } = useQuery({
    queryKey: ["my-join-requests"],
    queryFn: api.myJoinRequests,
    enabled: Boolean(session?.user),
    // Poll while something is waiting, so an acceptance shows up without a reload.
    refetchInterval: (query) =>
      (query.state.data ?? []).some((r) => r.status === "pending") ? 8_000 : false,
  });

  // An accepted request means a new team exists for this person: pick it up.
  const acceptedKey = requests
    .filter((r) => r.status === "accepted")
    .map((r) => r.id)
    .join(",");
  useEffect(() => {
    if (acceptedKey) void refreshTeams();
  }, [acceptedKey, refreshTeams]);

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    setBusy(true);

    // Slugs are unique across the install, so add a short suffix.
    const slug = `${slugify(teamName)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await authClient.organization.create({ name: teamName.trim(), slug });
    setBusy(false);

    if (error || !data) {
      toast.error(authErrorMessage(error, "Could not create the team"));
      return;
    }
    await refreshTeams();
    setTeamId(data.id);
    router.replace("/team");
  };

  const joinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 8) return;
    setBusy(true);
    try {
      const request = await api.joinTeam(code);
      toast.success(`Request sent to ${request.teamName}`);
      setCode("");
      void qc.invalidateQueries({ queryKey: ["my-join-requests"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the request");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await api.cancelJoinRequest(id);
      void qc.invalidateQueries({ queryKey: ["my-join-requests"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel the request");
    }
  };

  const openTeam = (teamId: string) => {
    setTeamId(teamId);
    router.replace("/tasks");
  };

  return (
    <AuthFrame
      title={teams.length ? "Add another team" : "Create or join a team"}
      subtitle="Start your own team, or type a team code to ask its owner to let you in."
      footer={
        teams.length > 0 ? (
          <button
            type="button"
            onClick={() => router.replace("/tasks")}
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted hover:text-ink"
          >
            ← Back to tasks
          </button>
        ) : null
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-[10px] border border-rule-strong bg-sunken p-1">
        {(
          [
            ["create", "Create a team", Plus],
            ["join", "Join with a code", Ticket],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-[7px] py-2 text-[13px] font-medium transition-colors",
              mode === value ? "bg-raised text-ink shadow-sm" : "text-ink-muted hover:text-ink",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {mode === "create" ? (
        <form onSubmit={createTeam} className="space-y-4">
          <div>
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Team name"
              maxLength={60}
              autoFocus
              required
            />
            <p className="mt-2 font-mono text-[11px] text-ink-muted">
              You&apos;ll be the owner, and get a code to share with your team.
            </p>
          </div>
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={busy || !teamName.trim()}
          >
            {busy ? "Creating…" : "Create team"}
            <ArrowRight className="size-4" />
          </Button>
        </form>
      ) : (
        <form onSubmit={joinTeam} className="space-y-4">
          <div>
            <Label htmlFor="team-code">Team code</Label>
            <Input
              id="team-code"
              value={formatCode(code)}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))
              }
              placeholder="XXXX-XXXX"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              className="h-12 text-center font-mono text-xl tracking-[0.2em]"
            />
            <p className="mt-2 font-mono text-[11px] text-ink-muted">
              Ask the team owner for it. They&apos;ll get your request to accept.
            </p>
          </div>
          <Button type="submit" variant="primary" className="w-full" disabled={busy || code.length < 8}>
            {busy ? "Sending…" : "Send join request"}
            <ArrowRight className="size-4" />
          </Button>
        </form>
      )}

      {requests.length > 0 && (
        <section className="mt-8">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            Your requests
          </p>
          <ul className="overflow-hidden rounded-[10px] border border-rule-strong bg-raised">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 border-b border-rule px-3 py-2.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] text-ink">{r.teamName}</p>
                  <span
                    className={cn(
                      "mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px]",
                      STATUS_STYLE[r.status],
                    )}
                  >
                    {r.status === "pending" && <Clock className="size-3" />}
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>

                {r.status === "pending" && (
                  <Button variant="ghost" size="sm" onClick={() => cancel(r.id)} aria-label="Cancel request">
                    <X className="size-4" />
                  </Button>
                )}
                {r.status === "accepted" && teams.some((t) => t.id === r.teamId) && (
                  <Button variant="primary" size="sm" onClick={() => openTeam(r.teamId)}>
                    Open
                    <ArrowRight className="size-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </AuthFrame>
  );
}
