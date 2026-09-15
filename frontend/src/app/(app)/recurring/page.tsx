"use client";

import { Pause, Play, Plus, Repeat, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { MonthDayPicker, WeekdayPicker } from "@/components/recurring/day-picker";
import { useRecurringMutations, useRecurringRules } from "@/components/recurring/use-recurring";
import { useMembers, useProjects } from "@/components/tasks/use-tasks";
import { useConfirm } from "@/components/confirm";
import {
  Avatar,
  Button,
  EmptyState,
  Input,
  Label,
  NumberField,
  Select,
  TimeField,
} from "@/components/ui";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/format";
import {
  FREQUENCY_LABEL,
  PERSONAL_PROJECT_ID,
  PRIORITY_LABEL,
  RECURRENCE_FREQUENCIES,
  TASK_PRIORITIES,
  type RecurrenceFrequency,
  type TaskPriority,
} from "@/lib/types";

function formatNextRun(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RecurringPage() {
  const { data: rules = [], isLoading } = useRecurringRules();
  const { data: projects = [] } = useProjects();
  const { data: members = [] } = useMembers();
  const { data: session } = useSession();
  const { create, update, runNow, remove } = useRecurringMutations();
  const confirm = useConfirm();

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("weekly");
  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [monthDays, setMonthDays] = useState<number[]>([1]);
  const [triggerTime, setTriggerTime] = useState("09:00");
  const [dueOffsetDays, setDueOffsetDays] = useState(0);
  const [priority, setPriority] = useState<TaskPriority>("medium");

  const isPersonal = projectId === PERSONAL_PROJECT_ID;
  const needsWeekdays = frequency === "weekly" || frequency === "biweekly";
  const needsMonthDays = frequency === "monthly";
  const effectiveAssignee = isPersonal ? (session?.user.id ?? "") : assigneeId;

  const daysMissing =
    (needsWeekdays && weekdays.length === 0) || (needsMonthDays && monthDays.length === 0);
  const canSubmit = Boolean(title.trim() && effectiveAssignee) && !daysMissing;

  const submit = () => {
    if (!canSubmit) return;
    create.mutate(
      {
        title: title.trim(),
        projectId: isPersonal ? null : projectId || null,
        assigneeId: effectiveAssignee,
        isPersonal,
        priority,
        frequency,
        weekdays: needsWeekdays ? weekdays : null,
        monthDays: needsMonthDays ? monthDays : null,
        triggerTime,
        dueOffsetDays,
      },
      { onSuccess: () => setTitle("") },
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-5 md:px-6 md:py-8">
      <h1 className="font-display text-3xl leading-none tracking-tight md:text-4xl">Recurring</h1>
      <p className="mt-2 text-sm text-ink-muted">
        These create a task on a schedule. Pick as many days as you need — two days a week is
        simply two days ticked. The assignee is fixed, and each task is due a set number of days
        after it appears.
      </p>

      {/* ------------------------------------------------------------- new rule */}
      <div className="mt-6 space-y-4 rounded-[10px] border border-rule-strong bg-raised p-3 md:p-4">
        <div>
          <Label htmlFor="rule-title">Task title</Label>
          <Input
            id="rule-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="What needs doing each time"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Label htmlFor="rule-project">Project</Label>
            <Select
              id="rule-project"
              value={projectId}
              onChange={setProjectId}
              ariaLabel="Project"
              options={[
                { value: PERSONAL_PROJECT_ID, label: "Personal", note: "private" },
                { value: "", label: "No project" },
                ...projects.map((p) => ({ value: p.id, label: p.name, dot: p.color })),
              ]}
            />
          </div>

          <div className="col-span-2 md:col-span-1">
            <Label htmlFor="rule-assignee">Assignee</Label>
            <Select
              id="rule-assignee"
              value={isPersonal ? "" : assigneeId}
              disabled={isPersonal}
              ariaLabel="Assignee"
              placeholder="Pick someone…"
              onChange={setAssigneeId}
              options={
                isPersonal
                  ? [{ value: "", label: session?.user.name ?? "You" }]
                  : members.map((m) => ({
                      value: m.userId,
                      label: m.user.name,
                      note: m.userId === session?.user.id ? "you" : undefined,
                    }))
              }
            />
          </div>

          <div>
            <Label htmlFor="rule-frequency">Repeats</Label>
            <Select
              id="rule-frequency"
              value={frequency}
              ariaLabel="Repeats"
              onChange={(v) => setFrequency(v as RecurrenceFrequency)}
              options={RECURRENCE_FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }))}
            />
          </div>

          <div>
            <Label htmlFor="rule-time">Trigger time</Label>
            <TimeField id="rule-time" value={triggerTime} onChange={setTriggerTime} />
          </div>

          <div>
            <Label htmlFor="rule-due">Due after (days)</Label>
            <NumberField
              id="rule-due"
              value={dueOffsetDays}
              onChange={setDueOffsetDays}
              min={0}
              max={365}
              suffix="days"
            />
          </div>

          <div>
            <Label htmlFor="rule-priority">Priority</Label>
            <Select
              id="rule-priority"
              value={priority}
              ariaLabel="Priority"
              onChange={(v) => setPriority(v as TaskPriority)}
              options={TASK_PRIORITIES.map((p) => ({
                value: p,
                label: PRIORITY_LABEL[p],
                dot: `var(--${p})`,
              }))}
            />
          </div>
        </div>

        {/* Day picker swaps with the frequency; daily needs none. */}
        {needsWeekdays && (
          <div>
            <Label>On which days</Label>
            <WeekdayPicker value={weekdays} onChange={setWeekdays} />
          </div>
        )}

        {needsMonthDays && (
          <div>
            <Label>On which dates</Label>
            <MonthDayPicker value={monthDays} onChange={setMonthDays} />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-3">
          <p className="font-mono text-[11px] text-ink-muted">
            {daysMissing
              ? "Pick at least one day"
              : dueOffsetDays === 0
                ? "Due the day it appears"
                : `Due ${dueOffsetDays} day${dueOffsetDays === 1 ? "" : "s"} later`}
          </p>
          <Button variant="primary" onClick={submit} disabled={!canSubmit || create.isPending}>
            <Plus className="size-4" />
            Add recurring task
          </Button>
        </div>
      </div>

      {/* ---------------------------------------------------------------- list */}
      <div className="mt-6 overflow-hidden rounded-[10px] border border-rule-strong bg-raised">
        {isLoading ? (
          <p className="p-4 font-mono text-xs text-ink-muted">Loading…</p>
        ) : rules.length === 0 ? (
          <EmptyState
            title="No recurring tasks"
            hint="Anything that comes back every week — a report, a standup, an invoice run — belongs here."
          />
        ) : (
          rules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-3 py-3 last:border-b-0 md:px-4",
                !rule.active && "opacity-60",
              )}
            >
              <Repeat
                className={cn("size-4 shrink-0", rule.active ? "text-signal" : "text-ink-muted")}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-ink">{rule.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-ink-muted">
                  <span>{rule.summary}</span>
                  {rule.isPersonal && <span className="text-signal">personal</span>}
                  {rule.projectName && (
                    <span className="inline-flex items-center gap-1">
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ background: rule.projectColor ?? "var(--ink-muted)" }}
                      />
                      {rule.projectName}
                    </span>
                  )}
                  <span>{rule.active ? `next ${formatNextRun(rule.nextRunAt)}` : "paused"}</span>
                </p>
              </div>

              {rule.assigneeName && (
                <Avatar name={rule.assigneeName} image={rule.assigneeImage} size={24} />
              )}

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  title="Create one now"
                  onClick={() => runNow.mutate(rule.id)}
                >
                  <Zap className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title={rule.active ? "Pause" : "Resume"}
                  onClick={() => update.mutate({ id: rule.id, active: !rule.active })}
                >
                  {rule.active ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Delete"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Delete this recurring task?",
                      body: `"${rule.title}" will stop creating tasks. Tasks it already made stay.`,
                      confirmLabel: "Delete",
                      tone: "danger",
                    });
                    if (ok) remove.mutate(rule.id);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
