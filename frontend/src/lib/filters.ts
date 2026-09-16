import { DEFAULT_FILTERS, type TaskFilters, type TaskPriority, type TaskStatus } from "./types";

/** Reads filter state out of the URL so a view can be bookmarked and shared. */
export function filtersFromParams(params: URLSearchParams): TaskFilters {
  const list = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);

  const scope = params.get("scope");
  const due = params.get("due");
  const sort = params.get("sort");
  const groupBy = params.get("groupBy");

  const isScope = (v: string | null): v is TaskFilters["scope"] =>
    v === "all" || v === "mine" || v === "personal" || v === "created";
  const isDue = (v: string | null): v is NonNullable<TaskFilters["due"]> =>
    v === "overdue" || v === "today" || v === "week" || v === "none";
  const isSort = (v: string | null): v is TaskFilters["sort"] =>
    v === "due" || v === "priority" || v === "created" || v === "updated";
  const isGroupBy = (v: string | null): v is TaskFilters["groupBy"] =>
    v === "none" || v === "project" || v === "assignee" || v === "status";

  return {
    ...DEFAULT_FILTERS,
    q: params.get("q") ?? "",
    projectIds: list("projectIds"),
    assigneeIds: list("assigneeIds"),
    status: list("status") as TaskStatus[],
    priority: list("priority") as TaskPriority[],
    due: isDue(due) ? due : null,
    scope: isScope(scope) ? scope : "all",
    showCompleted: params.get("showCompleted") === "true",
    sort: isSort(sort) ? sort : DEFAULT_FILTERS.sort,
    groupBy: isGroupBy(groupBy) ? groupBy : DEFAULT_FILTERS.groupBy,
  };
}

/** Writes filter state back to the URL, leaving defaults out to keep links short. */
export function paramsFromFilters(filters: TaskFilters): string {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.projectIds.length) p.set("projectIds", filters.projectIds.join(","));
  if (filters.assigneeIds.length) p.set("assigneeIds", filters.assigneeIds.join(","));
  if (filters.status.length) p.set("status", filters.status.join(","));
  if (filters.priority.length) p.set("priority", filters.priority.join(","));
  if (filters.due) p.set("due", filters.due);
  if (filters.scope !== "all") p.set("scope", filters.scope);
  if (filters.showCompleted) p.set("showCompleted", "true");
  if (filters.sort !== DEFAULT_FILTERS.sort) p.set("sort", filters.sort);
  if (filters.groupBy !== DEFAULT_FILTERS.groupBy) p.set("groupBy", filters.groupBy);
  return p.toString();
}
