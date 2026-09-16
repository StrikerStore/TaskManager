"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { FilterBar } from "@/components/tasks/filter-bar";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskRow } from "@/components/tasks/task-row";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { useTasks, useTaskMutations } from "@/components/tasks/use-tasks";
import { EmptyState, RowSkeleton } from "@/components/ui";
import { useSession } from "@/lib/auth-client";
import { filtersFromParams, paramsFromFilters } from "@/lib/filters";
import { STATUS_LABEL, TASK_STATUSES, type Task, type TaskFilters } from "@/lib/types";

function groupTasks(tasks: Task[], groupBy: TaskFilters["groupBy"]): Array<[string, Task[]]> {
  if (groupBy === "none") return [["", tasks]];

  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const key =
      groupBy === "project"
        ? (task.projectName ?? "No project")
        : groupBy === "assignee"
          ? (task.assigneeName ?? "Unassigned")
          : STATUS_LABEL[task.status];
    const bucket = groups.get(key);
    if (bucket) bucket.push(task);
    else groups.set(key, [task]);
  }
  // Status groups read best in their own order; everything else alphabetically,
  // with the catch-all bucket last.
  if (groupBy === "status") {
    const order = TASK_STATUSES.map((s) => STATUS_LABEL[s]);
    return [...groups.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  }

  const CATCH_ALL = new Set(["No project", "Unassigned"]);
  return [...groups.entries()].sort((a, b) => {
    const aLast = CATCH_ALL.has(a[0]);
    const bLast = CATCH_ALL.has(b[0]);
    if (aLast !== bLast) return aLast ? 1 : -1;
    return a[0].localeCompare(b[0]);
  });
}

function TasksView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [openTask, setOpenTask] = useState<Task | null>(null);

  const filters = useMemo(
    () => filtersFromParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const setFilters = useCallback(
    (patch: Partial<TaskFilters>) => {
      const next = { ...filters, ...patch };
      const qs = paramsFromFilters(next);
      router.replace(qs ? `/tasks?${qs}` : "/tasks", { scroll: false });
    },
    [filters, router],
  );

  const { data: tasks = [], isLoading } = useTasks(filters);
  const { toggle } = useTaskMutations();

  const groups = groupTasks(tasks, filters.groupBy);
  const heading =
    filters.scope === "personal"
      ? "Personal"
      : filters.scope === "mine"
        ? "Assigned to me"
        : filters.scope === "created"
          ? "Created by me"
          : "All tasks";

  return (
    <>
      <div className="flex items-baseline justify-between gap-3 px-3 pt-4 pb-1 md:px-4">
        <h1 className="font-display text-3xl leading-none tracking-tight md:text-4xl">{heading}</h1>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted sm:hidden">
          {tasks.length}
        </span>
      </div>

      <QuickAdd defaultPersonal={filters.scope === "personal"} />
      <FilterBar filters={filters} onChange={setFilters} count={tasks.length} />

      <div className="flex-1">
        {isLoading ? (
          <div>
            {Array.from({ length: 6 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            hint={
              filters.q || filters.projectIds.length
                ? "No task matches these filters. Try clearing a few."
                : "Type in the box above and press Enter to add the first task."
            }
          />
        ) : (
          groups.map(([label, group]) => (
            <section key={label || "all"}>
              {label && (
                <h2 className="sticky top-0 z-10 border-b border-rule bg-sunken/90 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted backdrop-blur md:px-4">
                  {label}
                  <span className="ml-2 text-ink-muted/70">{group.length}</span>
                </h2>
              )}
              {group.map((task, i) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  index={i}
                  onToggle={(t) => toggle.mutate(t)}
                  onOpen={setOpenTask}
                />
              ))}
            </section>
          ))
        )}
      </div>

      <TaskSheet
        task={openTask}
        currentUserId={session?.user.id ?? ""}
        onClose={() => setOpenTask(null)}
      />
    </>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="p-4 font-mono text-xs text-ink-muted">Loading…</div>}>
      <TasksView />
    </Suspense>
  );
}
