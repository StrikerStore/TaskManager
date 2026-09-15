"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { Team } from "@/lib/types";

type TeamContextValue = {
  teams: Team[];
  team: Team | null;
  teamId: string | null;
  loading: boolean;
  setTeamId: (id: string) => void;
  refreshTeams: () => Promise<void>;
};

const TeamContext = createContext<TeamContextValue | null>(null);
const STORAGE_KEY = "taskboard.teamId";

/** Remembers which team the person was last looking at, per browser. */
function readStoredTeamId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshTeams = useCallback(async () => {
    const { data, error } = await authClient.organization.list();
    if (error || !data) {
      setTeams([]);
      setLoading(false);
      return;
    }

    const list: Team[] = data.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      logo: o.logo,
    }));
    setTeams(list);

    setTeamIdState((current) => {
      if (current && list.some((t) => t.id === current)) return current;
      const stored = readStoredTeamId();
      if (stored && list.some((t) => t.id === stored)) return stored;
      return list[0]?.id ?? null;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshTeams();
  }, [refreshTeams]);

  const setTeamId = useCallback((id: string) => {
    setTeamIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Private mode or blocked storage: the choice just won't persist.
    }
    // Keep the server-side active organization in step for invitations etc.
    void authClient.organization.setActive({ organizationId: id });
  }, []);

  const value = useMemo<TeamContextValue>(
    () => ({
      teams,
      team: teams.find((t) => t.id === teamId) ?? null,
      teamId,
      loading,
      setTeamId,
      refreshTeams,
    }),
    [teams, teamId, loading, setTeamId, refreshTeams],
  );

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam(): TeamContextValue {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeam must be used inside <TeamProvider>");
  return ctx;
}
