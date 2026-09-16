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

  /**
   * The panel edits its own copy. Saving refreshes the list in the background,
   * and that refresh hands back the task as it was before the edit landed, so
   * reading straight from the prop would make a just-picked value flick back.
   */
  const [draft, setDraft] = useState<Task | null>(task);

  useEffect(() => {
    // Replace the copy only when a different task is opened, never on a refetch.
    setDraft((current) => (current && task && current.id === task.id ? current : task));
  }, [task]);

  if (!task || !draft) return null;

  const readOnly = draft.isPersonal && draft.createdById !== currentUserId;

  /** Show the change at once, and send it. */
  const edit = (changes: Partial<Task>, patch: Parameters<typeof update.mutate>[0]) => {
    setDraft({ ...draft, ...changes });
    update.mutate(patch);
  };

  const commitText = () => {
    const title = draft.title.trim();
    if (!title) return;
    const description = draft.description ?? "";
    if (title !== task.title || description !== (task.description ?? "")) {
      update.mutate({ id: draft.id, title, description: description || null });
    }
  };

  return (
    <Sheet
      open={Boolean(task)}
      onClose={() => {
        commitText();
        onClose();
      }}
      title={draft.isPersonal ? "Personal task" : "Task"}
      footer={
        <div className="flex items-center gap-2">
          <Button
            variant="danger"
            size="sm"
            disabled={readOnly}
            onClick={() => {
              remove.mutate(draft.id);
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
            value={draft.title}
            disabled={readOnly}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onBlur={commitText}
          />
        </div>

        <div>
          <Label htmlFor="task-desc">Notes</Label>
          <Textarea
            id="task-desc"
            value={draft.description ?? ""}
            disabled={readOnly}
            placeholder="Anything worth remembering…"
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            onBlur={commitText}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="task-status">Status</Label>
            <Select
              id="task-status"
              value={draft.status}
              disabled={readOnly}
              ariaLabel="Status"
              onChange={(v) =>
                edit({ status: v as TaskStatus }, { id: draft.id, status: v as TaskStatus })
              }
              options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
          </div>

          <div>
            <Label htmlFor="task-priority">Priority</Label>
            <Select
              id="task-priority"
              value={draft.priority}
              disabled={readOnly}
              ariaLabel="Priority"
              onChange={(v) =>
                edit({ priority: v as TaskPriority }, { id: draft.id, priority: v as TaskPriority })
              }
              options={TASK_PRIORITIES.map((p) => ({
                value: p,
                label: PRIORITY_LABEL[p],
                dot: `var(--${p})`,
              }))}
            />
          </div>

          {!draft.isPersonal && (
            <>
              <div>
                <Label htmlFor="task-project">Project</Label>
                <Select
                  id="task-project"
                  value={draft.projectId ?? ""}
                  disabled={readOnly}
                  ariaLabel="Project"
                  onChange={(v) => {
                    const project = projects.find((p) => p.id === v);
                    edit(
                      {
                        projectId: v || null,
                        projectName: project?.name ?? null,
                        projectColor: project?.color ?? null,
                      },
                      { id: draft.id, projectId: v || null },
                    );
                  }}
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
                  value={draft.assigneeId ?? ""}
                  disabled={readOnly}
                  ariaLabel="Assignee"
                  onChange={(v) => {
                    const member = members.find((m) => m.userId === v);
                    edit(
                      {
                        assigneeId: v || null,
                        assigneeName: member?.user.name ?? null,
                        assigneeImage: member?.user.image ?? null,
                      },
                      { id: draft.id, assigneeId: v || null },
                    );
                  }}
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
              value={toDateInputValue(draft.dueDate)}
              disabled={readOnly}
              onChange={(v) => {
                const dueDate = fromDateInputValue(v);
                edit({ dueDate }, { id: draft.id, dueDate });
              }}
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
