"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useMembers, useProjects, useTaskMutations } from "@/components/tasks/use-tasks";
import { Button, DateField, Input, Label, Select, Sheet, Textarea } from "@/components/ui";
import { fromDateInputValue, toDateInputValue } from "@/lib/format";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/types";

/** Detail editor: side panel on desktop, bottom drawer on phones. */
export function TaskSheet({
  task,
  currentUserId,
  onClose,
}: {
  task: Task | null;
  currentUserId: string;
  onClose: () => void;
}) {
  const { data: projects = [] } = useProjects();
  const { data: members = [] } = useMembers();
  const { update, remove } = useTaskMutations();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
  }, [task]);

  if (!task) return null;

  const readOnly = task.isPersonal && task.createdById !== currentUserId;

  const save = (patch: Parameters<typeof update.mutate>[0]) => update.mutate(patch);

  const commitText = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (trimmed !== task.title || description !== (task.description ?? "")) {
      save({ id: task.id, title: trimmed, description: description || null });
    }
  };

  return (
    <Sheet
      open={Boolean(task)}
      onClose={() => {
        commitText();
        onClose();
      }}
      title={task.isPersonal ? "Personal task" : "Task"}
      footer={
        <div className="flex items-center gap-2">
          <Button
            variant="danger"
            size="sm"
            disabled={readOnly}
            onClick={() => {
              remove.mutate(task.id);
              onClose();
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="ml-auto"
            onClick={() => {
              commitText();
              onClose();
            }}
          >
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="task-title">Title</Label>
          <Input
            id="task-title"
            value={title}
            disabled={readOnly}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitText}
          />
        </div>

        <div>
          <Label htmlFor="task-desc">Notes</Label>
          <Textarea
            id="task-desc"
            value={description}
            disabled={readOnly}
            placeholder="Anything worth remembering…"
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitText}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="task-status">Status</Label>
            <Select
              id="task-status"
              value={task.status}
              disabled={readOnly}
              ariaLabel="Status"
              onChange={(v) => save({ id: task.id, status: v as TaskStatus })}
              options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
          </div>

          <div>
            <Label htmlFor="task-priority">Priority</Label>
            <Select
              id="task-priority"
              value={task.priority}
              disabled={readOnly}
              ariaLabel="Priority"
              onChange={(v) => save({ id: task.id, priority: v as TaskPriority })}
              options={TASK_PRIORITIES.map((p) => ({
                value: p,
                label: PRIORITY_LABEL[p],
                dot: `var(--${p})`,
              }))}
            />
          </div>

          {!task.isPersonal && (
            <>
              <div>
                <Label htmlFor="task-project">Project</Label>
                <Select
                  id="task-project"
                  value={task.projectId ?? ""}
                  disabled={readOnly}
                  ariaLabel="Project"
                  onChange={(v) => save({ id: task.id, projectId: v || null })}
                  options={[
                    { value: "", label: "No project" },
                    ...projects.map((p) => ({ value: p.id, label: p.name, dot: p.color })),
                  ]}
                />
              </div>

              <div>
                <Label htmlFor="task-assignee">Assignee</Label>
                <Select
                  id="task-assignee"
                  value={task.assigneeId ?? ""}
                  disabled={readOnly}
                  ariaLabel="Assignee"
                  onChange={(v) => save({ id: task.id, assigneeId: v || null })}
                  options={[
                    { value: "", label: "Unassigned" },
                    ...members.map((m) => ({ value: m.userId, label: m.user.name })),
                  ]}
                />
              </div>
            </>
          )}

          <div className="col-span-2">
            <Label htmlFor="task-due">Due date</Label>
            <DateField
              id="task-due"
              value={toDateInputValue(task.dueDate)}
              disabled={readOnly}
              onChange={(v) => save({ id: task.id, dueDate: fromDateInputValue(v) })}
            />
          </div>
        </div>

        {readOnly && (
          <p className="rounded-[8px] border border-rule bg-sunken px-3 py-2 text-[13px] text-ink-muted">
            This is someone else&apos;s personal task, so it can&apos;t be edited.
          </p>
        )}
      </div>
    </Sheet>
  );
}
