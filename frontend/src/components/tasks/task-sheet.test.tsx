// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/lib/types";

const update = { mutate: vi.fn() };
const remove = { mutate: vi.fn() };

// The panel only needs projects, members and the mutations; skip react-query.
vi.mock("@/components/tasks/use-tasks", () => ({
  useProjects: () => ({
    data: [{ id: "p1", name: "Billing", color: "#c8410b", archived: false, createdAt: "", openCount: 0 }],
  }),
  useMembers: () => ({
    data: [{ id: "m1", userId: "u2", role: "member", user: { id: "u2", name: "Riya", username: "riya" } }],
  }),
  useTaskMutations: () => ({ update, remove }),
}));

const { TaskSheet } = await import("./task-sheet");

const task: Task = {
  id: "t1",
  title: "Ship the invoice fix",
  description: null,
  status: "todo",
  priority: "medium",
  dueDate: null,
  isPersonal: false,
  completedAt: null,
  createdAt: "2026-09-16T10:00:00.000Z",
  updatedAt: "2026-09-16T10:00:00.000Z",
  createdById: "u1",
  projectId: null,
  projectName: null,
  projectColor: null,
  assigneeId: null,
  assigneeName: null,
  assigneeImage: null,
};

afterEach(cleanup);
beforeEach(() => {
  update.mutate.mockClear();
  remove.mutate.mockClear();
});

describe("TaskSheet", () => {
  it("shows a newly picked status straight away", async () => {
    const user = userEvent.setup();
    render(<TaskSheet task={task} currentUserId="u1" onClose={() => {}} />);

    const status = screen.getByRole("combobox", { name: "Status" });
    expect(status.textContent).toContain("To do");

    await user.click(status);
    await user.click(screen.getByRole("option", { name: /In progress/ }));

    expect(update.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1", status: "in_progress" }),
    );
    expect(screen.getByRole("combobox", { name: "Status" }).textContent).toContain("In progress");
  });

  it("shows a newly picked project straight away", async () => {
    const user = userEvent.setup();
    render(<TaskSheet task={task} currentUserId="u1" onClose={() => {}} />);

    const project = screen.getByRole("combobox", { name: "Project" });
    expect(project.textContent).toContain("No project");

    await user.click(project);
    await user.click(screen.getByRole("option", { name: /Billing/ }));

    expect(update.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1", projectId: "p1" }),
    );
    expect(screen.getByRole("combobox", { name: "Project" }).textContent).toContain("Billing");
  });

  it("keeps every character typed into Notes", async () => {
    const user = userEvent.setup();
    render(<TaskSheet task={task} currentUserId="u1" onClose={() => {}} />);

    const notes = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    await user.click(notes);
    await user.keyboard("Call the bank");

    expect(notes.value).toBe("Call the bank");
    expect(document.activeElement).toBe(notes);
  });

  it("keeps showing a fresher value when the task list refreshes with stale data", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <TaskSheet task={task} currentUserId="u1" onClose={() => {}} />,
    );

    await user.click(screen.getByRole("combobox", { name: "Priority" }));
    await user.click(screen.getByRole("option", { name: /Urgent/ }));
    expect(screen.getByRole("combobox", { name: "Priority" }).textContent).toContain("Urgent");

    // A background refetch hands the same task object back, still saying "medium".
    rerender(<TaskSheet task={{ ...task }} currentUserId="u1" onClose={() => {}} />);
    expect(screen.getByRole("combobox", { name: "Priority" }).textContent).toContain("Urgent");
  });
});
