"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMembers, useProjects } from "@/components/tasks/use-tasks";
import { Chip, Select } from "@/components/ui";
import { cn } from "@/lib/format";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskFilters,
} from "@/lib/types";

const DUE_OPTIONS = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "none", label: "No date" },
] as const;

const SCOPES = [
  { value: "all", label: "Team" },
  { value: "mine", label: "Assigned to me" },
  { value: "created", label: "Created by me" },
  { value: "personal", label: "Personal" },
] as const;

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterBar({
  filters,
  onChange,
  count,
}: {
  filters: TaskFilters;
  onChange: (next: Partial<TaskFilters>) => void;
  count: number;
}) {
  const { data: projects = [] } = useProjects();
  const { data: members = [] } = useMembers();
  const [expanded, setExpanded] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (!typing && e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const activeCount =
    filters.projectIds.length +
    filters.assigneeIds.length +
    filters.status.length +
    filters.priority.length +
    (filters.due ? 1 : 0) +
    (filters.scope !== "all" ? 1 : 0) +
    (filters.showCompleted ? 1 : 0);

  return (
    <div className="border-b border-rule bg-paper/95 backdrop-blur">
      {/* Row 1: search + scope + count */}
      <div className="flex items-center gap-2 px-3 py-2 md:px-4">
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-rule-strong bg-raised px-2.5">
          <Search className="size-4 shrink-0 text-ink-muted" />
          <input
            ref={searchRef}
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Search tasks…"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted/70"
            aria-label="Search tasks"
          />
          {filters.q && (
            <button type="button" onClick={() => onChange({ q: "" })} aria-label="Clear search">
              <X className="size-3.5 text-ink-muted" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] border px-2.5 text-[13px] transition-colors",
            expanded || activeCount > 0
              ? "border-signal bg-signal-soft text-signal"
              : "border-rule-strong bg-raised text-ink-soft",
          )}
          aria-expanded={expanded}
        >
          <SlidersHorizontal className="size-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && <span className="font-mono text-[11px]">{activeCount}</span>}
        </button>

        <span className="hidden shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted sm:inline">
          {count} {count === 1 ? "task" : "tasks"}
        </span>
      </div>

      {/* Row 2: always-visible scope chips */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2 md:px-4">
        {SCOPES.map((s) => (
          <Chip
            key={s.value}
            active={filters.scope === s.value}
            onClick={() => onChange({ scope: s.value })}
          >
            {s.label}
          </Chip>
        ))}
        <Chip
          active={filters.showCompleted}
          onClick={() => onChange({ showCompleted: !filters.showCompleted })}
        >
          Show done
        </Chip>
      </div>

      {/* Row 3: the rest, collapsed by default (especially valuable on phones) */}
      {expanded && (
        <div className="space-y-3 border-t border-rule px-3 py-3 md:px-4">
          <FilterGroup label="Project">
            {projects.map((p) => (
              <Chip
                key={p.id}
                dot={p.color}
                active={filters.projectIds.includes(p.id)}
                onClick={() => onChange({ projectIds: toggleIn(filters.projectIds, p.id) })}
              >
                {p.name}
              </Chip>
            ))}
            <Chip
              active={filters.projectIds.includes("none")}
              onClick={() => onChange({ projectIds: toggleIn(filters.projectIds, "none") })}
            >
              No project
            </Chip>
          </FilterGroup>

          <FilterGroup label="Assignee">
            {members.map((m) => (
              <Chip
                key={m.userId}
                active={filters.assigneeIds.includes(m.userId)}
                onClick={() => onChange({ assigneeIds: toggleIn(filters.assigneeIds, m.userId) })}
              >
                {m.user.name}
              </Chip>
            ))}
            <Chip
              active={filters.assigneeIds.includes("unassigned")}
              onClick={() => onChange({ assigneeIds: toggleIn(filters.assigneeIds, "unassigned") })}
            >
              Unassigned
            </Chip>
          </FilterGroup>

          <FilterGroup label="Status">
            {TASK_STATUSES.map((s) => (
              <Chip
                key={s}
                active={filters.status.includes(s)}
                onClick={() => onChange({ status: toggleIn(filters.status, s) })}
              >
                {STATUS_LABEL[s]}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Priority">
            {TASK_PRIORITIES.map((p) => (
              <Chip
                key={p}
                active={filters.priority.includes(p)}
                onClick={() => onChange({ priority: toggleIn(filters.priority, p) })}
              >
                {PRIORITY_LABEL[p]}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Due">
            {DUE_OPTIONS.map((d) => (
              <Chip
                key={d.value}
                active={filters.due === d.value}
                onClick={() => onChange({ due: filters.due === d.value ? null : d.value })}
              >
                {d.label}
              </Chip>
            ))}
          </FilterGroup>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <LabeledSelect
              label="Group by"
              value={filters.groupBy}
              onChange={(v) => onChange({ groupBy: v as TaskFilters["groupBy"] })}
              options={[
                ["none", "Nothing"],
                ["project", "Project"],
                ["assignee", "Assignee"],
                ["status", "Status"],
              ]}
            />
            <LabeledSelect
              label="Sort"
              value={filters.sort}
              onChange={(v) => onChange({ sort: v as TaskFilters["sort"] })}
              options={[
                ["created", "Newest"],
                ["due", "Due date"],
                ["priority", "Priority"],
                ["updated", "Recently updated"],
              ]}
            />
            {activeCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    projectIds: [],
                    assigneeIds: [],
                    status: [],
                    priority: [],
                    due: null,
                    scope: "all",
                    showCompleted: false,
                  })
                }
                className="ml-auto font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </span>
      <Select
        value={value}
        onChange={onChange}
        ariaLabel={label}
        size="sm"
        wrapperClassName="w-40"
        options={options.map(([v, l]) => ({ value: v, label: l }))}
      />
    </label>
  );
}
