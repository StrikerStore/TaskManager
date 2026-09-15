import { API_URL } from "./auth-client";
import type {
  JoinRequest,
  MyJoinRequest,
  Project,
  RecurrenceFrequency,
  RecurringRule,
  Task,
  TaskFilters,
  TaskPriority,
  TaskStatus,
  TeamMember,
} from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * fetch wrapper for the Express API: always sends the session cookie and the
 * current team, and turns non-2xx responses into ApiError.
 */
async function request<T>(
  path: string,
  options: RequestInit & { teamId?: string | null } = {},
): Promise<T> {
  const { teamId, headers, ...init } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(teamId ? { "x-team-id": teamId } : {}),
      ...headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const payload: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      (payload as { error?: string }).error ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return payload as T;
}

function filtersToQuery(filters: TaskFilters): string {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.projectIds.length) p.set("projectIds", filters.projectIds.join(","));
  if (filters.assigneeIds.length) p.set("assigneeIds", filters.assigneeIds.join(","));
  if (filters.status.length) p.set("status", filters.status.join(","));
  if (filters.priority.length) p.set("priority", filters.priority.join(","));
  if (filters.due) p.set("due", filters.due);
  p.set("scope", filters.scope);
  p.set("showCompleted", String(filters.showCompleted));
  p.set("sort", filters.sort);
  return p.toString();
}

export type TaskInput = {
  title: string;
  description?: string | null;
  projectId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  isPersonal?: boolean;
};

export type RuleInput = {
  title: string;
  description?: string | null;
  projectId?: string | null;
  priority?: TaskPriority;
  assigneeId: string;
  isPersonal?: boolean;
  frequency: RecurrenceFrequency;
  weekdays?: number[] | null;
  monthDays?: number[] | null;
  triggerTime: string;
  dueOffsetDays?: number;
  active?: boolean;
};

export const api = {
  listTasks: (teamId: string, filters: TaskFilters) =>
    request<{ tasks: Task[] }>(`/api/tasks?${filtersToQuery(filters)}`, { teamId }).then(
      (r) => r.tasks,
    ),

  createTask: (teamId: string, input: TaskInput) =>
    request<{ task: Task }>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(input),
      teamId,
    }).then((r) => r.task),

  updateTask: (teamId: string, id: string, input: Partial<TaskInput>) =>
    request<{ task: Task }>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
      teamId,
    }).then((r) => r.task),

  toggleTask: (teamId: string, id: string) =>
    request<{ task: Task }>(`/api/tasks/${id}/toggle`, { method: "POST", teamId }).then(
      (r) => r.task,
    ),

  deleteTask: (teamId: string, id: string) =>
    request<void>(`/api/tasks/${id}`, { method: "DELETE", teamId }),

  listProjects: (teamId: string, includeArchived = false) =>
    request<{ projects: Project[] }>(
      `/api/projects${includeArchived ? "?includeArchived=true" : ""}`,
      { teamId },
    ).then((r) => r.projects),

  createProject: (teamId: string, input: { name: string; color?: string }) =>
    request<{ project: Project }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(input),
      teamId,
    }).then((r) => r.project),

  updateProject: (
    teamId: string,
    id: string,
    input: { name?: string; color?: string; archived?: boolean },
  ) =>
    request<{ project: Project }>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
      teamId,
    }).then((r) => r.project),

  deleteProject: (teamId: string, id: string) =>
    request<void>(`/api/projects/${id}`, { method: "DELETE", teamId }),

  listRules: (teamId: string) =>
    request<{ rules: RecurringRule[] }>("/api/recurring", { teamId }).then((r) => r.rules),

  createRule: (teamId: string, input: RuleInput) =>
    request<{ rule: RecurringRule }>("/api/recurring", {
      method: "POST",
      body: JSON.stringify(input),
      teamId,
    }).then((r) => r.rule),

  updateRule: (teamId: string, id: string, input: Partial<RuleInput>) =>
    request<{ rule: RecurringRule }>(`/api/recurring/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
      teamId,
    }).then((r) => r.rule),

  runRuleNow: (teamId: string, id: string) =>
    request<{ task: Task }>(`/api/recurring/${id}/run-now`, { method: "POST", teamId }).then(
      (r) => r.task,
    ),

  deleteRule: (teamId: string, id: string) =>
    request<void>(`/api/recurring/${id}`, { method: "DELETE", teamId }),

  listMembers: (teamId: string) =>
    request<{ members: TeamMember[] }>("/api/teams/members", { teamId }).then((r) => r.members),

  removeMember: (teamId: string, userId: string) =>
    request<void>(`/api/teams/members/${userId}`, { method: "DELETE", teamId }),

  getTeamCode: (teamId: string) =>
    request<{ code: string }>("/api/teams/code", { teamId }).then((r) => r.code),

  rotateTeamCode: (teamId: string) =>
    request<{ code: string }>("/api/teams/code/rotate", { method: "POST", teamId }).then(
      (r) => r.code,
    ),

  listJoinRequests: (teamId: string) =>
    request<{ requests: JoinRequest[] }>("/api/teams/requests", { teamId }).then(
      (r) => r.requests,
    ),

  acceptJoinRequest: (teamId: string, id: string) =>
    request<{ ok: true }>(`/api/teams/requests/${id}/accept`, { method: "POST", teamId }),

  rejectJoinRequest: (teamId: string, id: string) =>
    request<{ ok: true }>(`/api/teams/requests/${id}/reject`, { method: "POST", teamId }),

  joinTeam: (code: string) =>
    request<{ request: MyJoinRequest }>("/api/teams/join", {
      method: "POST",
      body: JSON.stringify({ code }),
    }).then((r) => r.request),

  myJoinRequests: () =>
    request<{ requests: MyJoinRequest[] }>("/api/teams/my-requests").then((r) => r.requests),

  cancelJoinRequest: (id: string) =>
    request<void>(`/api/teams/my-requests/${id}`, { method: "DELETE" }),
};
