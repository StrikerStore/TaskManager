"use client";

import { Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAllProjects, useProjectMutations } from "@/components/tasks/use-tasks";
import { useConfirm } from "@/components/confirm";
import { Button, EmptyState, Input, Label } from "@/components/ui";
import type { Project } from "@/lib/types";

const SWATCHES = ["#c8410b", "#b45309", "#3f6f4a", "#1d6f8a", "#4c4fa8", "#8a2f5f", "#6b7280"];

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useAllProjects();
  const { create, update, remove } = useProjectMutations();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]!);

  const active = projects.filter((p) => !p.archived);
  const archived = projects.filter((p) => p.archived);

  const askDelete = async (project: Project) => {
    const ok = await confirm({
      title: `Delete "${project.name}"?`,
      body: "Its tasks stay, just without a project.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (ok) remove.mutate(project.id);
  };

  const addProject = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate({ name: trimmed, color });
    setName("");
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-5 md:px-6 md:py-8">
      <h1 className="font-display text-3xl leading-none tracking-tight md:text-4xl">Projects</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Projects group the team&apos;s tasks. Everyone on the team sees all of them.
      </p>

      <div className="mt-6 rounded-[10px] border border-rule-strong bg-raised p-3 md:p-4">
        <Label htmlFor="project-name">New project</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addProject()}
            placeholder="Project name"
            className="flex-1"
          />
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  onClick={() => setColor(c)}
                  className="size-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ background: c, borderColor: c === color ? "var(--ink)" : "transparent" }}
                />
              ))}
            </div>
            <Button
              variant="primary"
              onClick={addProject}
              disabled={!name.trim() || create.isPending}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-[10px] border border-rule-strong bg-raised">
        {isLoading ? (
          <p className="p-4 font-mono text-xs text-ink-muted">Loading…</p>
        ) : active.length === 0 ? (
          <EmptyState title="No projects yet" hint="Add one above to start grouping tasks." />
        ) : (
          active.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              onArchive={() => update.mutate({ id: project.id, archived: true })}
              onDelete={() => askDelete(project)}
            />
          ))
        )}
      </div>

      {archived.length > 0 && (
        <>
          <h2 className="mt-8 mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            Archived · {archived.length}
          </h2>
          <div className="overflow-hidden rounded-[10px] border border-rule bg-sunken/50">
            {archived.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                onRestore={() => update.mutate({ id: project.id, archived: false })}
                onDelete={() => askDelete(project)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  onArchive,
  onRestore,
  onDelete,
}: {
  project: Project;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-rule px-3 py-3 last:border-b-0 md:px-4">
      <span
        aria-hidden
        className="size-3 shrink-0 rounded-full"
        style={{ background: project.color, opacity: project.archived ? 0.4 : 1 }}
      />
      <Link
        href={`/tasks?projectIds=${project.id}`}
        className={`min-w-0 flex-1 truncate text-[15px] hover:text-signal ${
          project.archived ? "text-ink-muted" : "text-ink"
        }`}
      >
        {project.name}
      </Link>
      <span className="font-mono text-[11px] text-ink-muted">{project.openCount} open</span>
      {onArchive && (
        <Button variant="ghost" size="sm" title="Archive" onClick={onArchive}>
          <Archive className="size-4" />
        </Button>
      )}
      {onRestore && (
        <Button variant="ghost" size="sm" title="Restore" onClick={onRestore}>
          <ArchiveRestore className="size-4" />
        </Button>
      )}
      <Button variant="ghost" size="sm" title="Delete" onClick={onDelete}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
