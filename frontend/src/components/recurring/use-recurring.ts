"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTeam } from "@/components/team-context";
import { api, type RuleInput } from "@/lib/api";

export function useRecurringRules() {
  const { teamId } = useTeam();
  return useQuery({
    queryKey: ["recurring", teamId],
    queryFn: () => api.listRules(teamId!),
    enabled: Boolean(teamId),
  });
}

export function useRecurringMutations() {
  const { teamId } = useTeam();
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["recurring", teamId] });
    void qc.invalidateQueries({ queryKey: ["tasks", teamId] });
  };

  const create = useMutation({
    mutationFn: (input: RuleInput) => api.createRule(teamId!, input),
    onSuccess: () => {
      invalidate();
      toast.success("Recurring task saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: Partial<RuleInput> & { id: string }) =>
      api.updateRule(teamId!, id, input),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const runNow = useMutation({
    mutationFn: (id: string) => api.runRuleNow(teamId!, id),
    onSuccess: (task) => {
      invalidate();
      toast.success(`Created "${task.title}"`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteRule(teamId!, id),
    onSuccess: () => {
      invalidate();
      toast("Recurring task deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { create, update, runNow, remove };
}
