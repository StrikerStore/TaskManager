"use client";

import { Check, Lock } from "lucide-react";
import { Avatar } from "@/components/ui";
import { cn, formatDue } from "@/lib/format";
import type { Task } from "@/lib/types";

const PRIORITY_COLOR: Record<Task["priority"], string> = {
  urgent: "var(--urgent)",
  high: "var(--high)",
  medium: "var(--medium)",
  low: "var(--low)",
};

const DUE_TONE: Record<"overdue" | "today" | "soon" | "normal", string> = {
  overdue: "text-urgent font-medium",
  today: "text-signal font-medium",
  soon: "text-ink-soft",
  normal: "text-ink-muted",
};

export function TaskRow({
  task,
  index,
  onToggle,
  onOpen,
}: {
  task: Task;
  index: number;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
}) {
  const done = task.status === "done";
  const due = formatDue(task.dueDate);

  return (
    <div
      className="row-in group flex items-start gap-3 border-b border-rule px-3 py-2.5 transition-colors hover:bg-raised md:px-4"
      style={{ animationDelay: `${Math.min(index, 12) * 18}ms` }}
    >
      {/* Left rail: priority tick + checkbox */}
      <span
        aria-hidden
        className="mt-[7px] h-5 w-[3px] shrink-0 rounded-full"
        style={{ background: done ? "transparent" : PRIORITY_COLOR[task.priority] }}
      />

      <button
        type="button"
        onClick={() => onToggle(task)}
        aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        aria-pressed={done}
        className={cn(
          "mt-[3px] flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-all",
          done
            ? "border-done bg-done text-paper"
            : "border-rule-strong bg-raised hover:border-signal hover:scale-110",
        )}
      >
        {done && <Check className="size-3" strokeWidth={3} />}
      </button>

      <button
        type="button"
        onClick={() => onOpen(task)}
        className="min-w-0 flex-1 text-left"
      >
        <span
          className={cn(
            "block text-[15px] leading-snug",
            done ? "text-ink-muted line-through decoration-ink-muted/50" : "text-ink",
          )}
        >
          {task.title}
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px]">
          {task.isPersonal && (
            <span className="inline-flex items-center gap-1 font-mono text-ink-muted">
              <Lock className="size-3" />
              personal
            </span>
          )}
          {task.projectName && (
            <span className="inline-flex items-center gap-1.5 text-ink-soft">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: task.projectColor ?? "var(--ink-muted)" }}
              />
              {task.projectName}
            </span>
          )}
          {due && <span className={cn("font-mono", DUE_TONE[due.tone])}>{due.label}</span>}
          {task.status === "in_progress" && (
            <span className="rounded-full bg-signal-soft px-1.5 py-px font-mono text-[11px] text-signal">
              in progress
            </span>
          )}
        </span>
      </button>

      {task.assigneeName ? (
        <span className="mt-0.5 shrink-0">
          <Avatar name={task.assigneeName} image={task.assigneeImage} size={24} />
        </span>
      ) : (
        <span className="mt-0.5 hidden size-6 shrink-0 rounded-full border border-dashed border-rule-strong md:block" />
      )}
    </div>
  );
}
