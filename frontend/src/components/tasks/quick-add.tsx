"use client";

import { CornerDownLeft, Lock, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMembers, useProjects, useTaskMutations } from "@/components/tasks/use-tasks";
import { Button, Select } from "@/components/ui";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/format";
import { PERSONAL_PROJECT_ID } from "@/lib/types";

/**
 * Title on top; project and assignee below it. Choosing the "Personal" project
 * makes the task private and assigns it to you.
 */
export function QuickAdd({ defaultPersonal = false }: { defaultPersonal?: boolean }) {
  const { data: session } = useSession();
  const { data: projects = [] } = useProjects();
  const { data: members = [] } = useMembers();
  const { create } = useTaskMutations();

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(defaultPersonal ? PERSONAL_PROJECT_ID : "");
  const [assigneeId, setAssigneeId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isPersonal = projectId === PERSONAL_PROJECT_ID;

  // Follow the current view: the Personal list adds personal tasks by default.
  useEffect(() => {
    setProjectId(defaultPersonal ? PERSONAL_PROJECT_ID : "");
  }, [defaultPersonal]);

  // "N" anywhere on the page jumps into the title box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (typing) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    create.mutate({
      title: trimmed,
      isPersonal,
      // A personal task carries no project and is always your own.
      projectId: isPersonal ? null : projectId || null,
      assigneeId: isPersonal ? null : assigneeId || null,
    });

    setTitle("");
    inputRef.current?.focus();
  };

  return (
    <div className="border-b border-rule bg-paper/95 px-3 py-2.5 backdrop-blur md:px-4">
      <div
        className={cn(
          "flex items-center gap-2 rounded-[10px] border bg-raised px-3 transition-colors",
          title ? "border-signal" : "border-rule-strong",
        )}
      >
        {isPersonal ? (
          <Lock className="size-4 shrink-0 text-signal" />
        ) : (
          <Plus className="size-4 shrink-0 text-ink-muted" />
        )}
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") setTitle("");
          }}
          placeholder={isPersonal ? "Add a personal task…" : "Add a task…"}
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted/70"
          aria-label="Task title"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Select
          value={projectId}
          onChange={setProjectId}
          ariaLabel="Project"
          size="sm"
          wrapperClassName="min-w-0 flex-1 sm:flex-none sm:w-44"
          options={[
            { value: PERSONAL_PROJECT_ID, label: "Personal", note: "private" },
            { value: "", label: "No project" },
            ...projects.map((p) => ({ value: p.id, label: p.name, dot: p.color })),
          ]}
        />

        <Select
          value={isPersonal ? "" : assigneeId}
          onChange={setAssigneeId}
          disabled={isPersonal}
          ariaLabel="Assignee"
          title={isPersonal ? "Personal tasks are always yours" : "Assignee"}
          size="sm"
          wrapperClassName="min-w-0 flex-1 sm:flex-none sm:w-44"
          options={
            isPersonal
              ? [{ value: "", label: session?.user.name ?? "You" }]
              : [
                  { value: "", label: "Unassigned" },
                  ...members.map((m) => ({
                    value: m.userId,
                    label: m.user.name,
                    note: m.userId === session?.user.id ? "you" : undefined,
                  })),
                ]
          }
        />

        <Button
          variant="primary"
          size="sm"
          onClick={submit}
          disabled={!title.trim() || create.isPending}
          className="ml-auto h-9 shrink-0 px-3.5"
        >
          Add
          <CornerDownLeft className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
