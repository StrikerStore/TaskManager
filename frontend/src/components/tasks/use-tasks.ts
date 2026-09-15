"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTeam } from "@/components/team-context";
import { api, type TaskInput } from "@/lib/api";
import type { Task, TaskFilters } from "@/lib/types";

export function useProjects() {
  const { teamId } = useTeam();
  return useQuery({
    queryKey: ["projects", teamId],
    queryFn: () => api.listProjects(teamId!),
    enabled: Boolean(teamId),
  });
}

/** Includes archived projects; used by the projects admin page. */
export function useAllProjects() {
  const { teamId } = useTeam();
  return useQuery({
    queryKey: ["projects", teamId, "withArchived"],
    queryFn: () => api.listProjects(teamId!, true),
    enabled: Boolean(teamId),
  });
}

export function useMembers() {
  const { teamId } = useTeam();
  return useQuery({
    queryKey: ["members", teamId],
    queryFn: () => api.listMembers(teamId!),
    enabled: Boolean(teamId),
  });
}

export function useTasks(filters: TaskFilters) {
  const { teamId } = useTeam();
  return useQuery({
    queryKey: ["tasks", teamId, filters],
    queryFn: () => api.listTasks(teamId!, filters),
    enabled: Boolean(teamId),
    placeholderData: (previous) => previous,
  });
}

/** Create / update / toggle / delete, all invalidating the same task lists. */
export function useTaskMutations() {
  const { teamId } = useTeam();
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["tasks", teamId] });
    void qc.invalidateQueries({ queryKey: ["projects", teamId] });
  };

  const create = useMutation({
    mutationFn: (input: TaskInput) => api.createTask(teamId!, input),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: Partial<TaskInput> & { id: string }) =>
      api.updateTask(teamId!, id, input),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (task: Task) => api.toggleTask(teamId!, task.id),
    // Optimistic: the checkbox must feel instant.
    onMutate: async (task) => {
      await qc.cancelQueries({ queryKey: ["tasks", teamId] });
      const snapshots = qc.getQueriesData<Task[]>({ queryKey: ["tasks", teamId] });
      for (const [key, list] of snapshots) {
        if (!list) continue;
        qc.setQueryData<Task[]>(
          key,
          list.map((t) =>
            t.id === task.id
              ? { ...t, status: t.status === "done" ? "todo" : "done" }
              : t,
          ),
        );
      }
      return { snapshots };
    },
    onError: (e: Error, _task, context) => {
      for (const [key, list] of context?.snapshots ?? []) qc.setQueryData(key, list);
      toast.error(e.message);
    },
    onSuccess: (updated) => {
      if (updated.status === "done") {
        toast(`Done: ${updated.title}`, {
          action: {
            label: "Undo",
            onClick: () => toggle.mutate(updated),
          },
        });
      }
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteTask(teamId!, id),
    onSuccess: () => {
      invalidate();
      toast("Task deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { create, update, toggle, remove };
}

export function useProjectMutations() {
  const { teamId } = useTeam();
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["projects", teamId] });
    void qc.invalidateQueries({ queryKey: ["tasks", teamId] });
  };

  const create = useMutation({
    mutationFn: (input: { name: string; color?: string }) => api.createProject(teamId!, input),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; color?: string; archived?: boolean }) =>
      api.updateProject(teamId!, id, input),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteProject(teamId!, id),
    onSuccess: () => {
      invalidate();
      toast("Project deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { create, update, remove };
}
