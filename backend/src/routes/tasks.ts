import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { member, project, task, taskPriorities, taskStatuses, user } from "../db/schema.js";
import { badRequest, forbidden, notFound, param } from "../lib/http.js";
import { newId } from "../lib/ids.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireTeam } from "../middleware/require-team.js";

export const tasksRouter = Router();
tasksRouter.use(requireAuth, requireTeam);

/**
 * Every task query goes through this: a task is visible when it belongs to the
 * team AND (it is a team task OR the caller created it).
 */
function visibleTasks(teamId: string, userId: string): SQL {
  return and(
    eq(task.organizationId, teamId),
    or(eq(task.isPersonal, false), eq(task.createdById, userId)),
  )!;
}

const csv = z
  .string()
  .transform((s) =>
    s
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string()).max(50));

const FilterQuery = z.object({
  q: z.string().trim().max(200).optional(),
  projectIds: csv.optional(), // may contain the literal "none"
  assigneeIds: csv.optional(), // may contain the literal "unassigned"
  status: csv.optional(),
  priority: csv.optional(),
  due: z.enum(["overdue", "today", "week", "none"]).optional(),
  scope: z.enum(["all", "mine", "personal", "created"]).default("all"),
  showCompleted: z.enum(["true", "false"]).default("false"),
  sort: z.enum(["due", "priority", "created", "updated"]).default("created"),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/** GET /api/tasks — filtered list, with project and assignee details joined in. */
tasksRouter.get("/", async (req, res, next) => {
  const parsed = FilterQuery.safeParse(req.query);
  if (!parsed.success) return next(badRequest(parsed.error.issues[0]?.message));
  const f = parsed.data;

  const where: SQL[] = [visibleTasks(req.team.id, req.user.id)];

  if (f.q) {
    const like = `%${f.q}%`;
    where.push(or(sql`${task.title} like ${like}`, sql`${task.description} like ${like}`)!);
  }

  if (f.projectIds?.length) {
    const ids = f.projectIds.filter((id) => id !== "none");
    const clauses: SQL[] = [];
    if (ids.length) clauses.push(inArray(task.projectId, ids));
    if (f.projectIds.includes("none")) clauses.push(isNull(task.projectId));
    if (clauses.length) where.push(clauses.length === 1 ? clauses[0]! : or(...clauses)!);
  }

  if (f.assigneeIds?.length) {
    const ids = f.assigneeIds.filter((id) => id !== "unassigned");
    const clauses: SQL[] = [];
    if (ids.length) clauses.push(inArray(task.assigneeId, ids));
    if (f.assigneeIds.includes("unassigned")) clauses.push(isNull(task.assigneeId));
    if (clauses.length) where.push(clauses.length === 1 ? clauses[0]! : or(...clauses)!);
  }

  if (f.status?.length) {
    const valid = f.status.filter((s): s is (typeof taskStatuses)[number] =>
      (taskStatuses as readonly string[]).includes(s),
    );
    if (valid.length) where.push(inArray(task.status, valid));
  }

  if (f.priority?.length) {
    const valid = f.priority.filter((p): p is (typeof taskPriorities)[number] =>
      (taskPriorities as readonly string[]).includes(p),
    );
    if (valid.length) where.push(inArray(task.priority, valid));
  }

  if (f.due === "overdue") {
    where.push(and(lt(task.dueDate, startOfToday()), ne(task.status, "done"))!);
  } else if (f.due === "today") {
    where.push(and(gte(task.dueDate, startOfToday()), lte(task.dueDate, endOfToday()))!);
  } else if (f.due === "week") {
    const weekEnd = startOfToday();
    weekEnd.setDate(weekEnd.getDate() + 7);
    where.push(and(gte(task.dueDate, startOfToday()), lte(task.dueDate, weekEnd))!);
  } else if (f.due === "none") {
    where.push(isNull(task.dueDate));
  }

  if (f.scope === "mine") where.push(eq(task.assigneeId, req.user.id));
  if (f.scope === "created") where.push(eq(task.createdById, req.user.id));
  if (f.scope === "personal") where.push(eq(task.isPersonal, true));
  if (f.scope === "all") where.push(eq(task.isPersonal, false));

  // "Show done" hides finished tasks, unless the status filter asks for them by
  // name — otherwise picking "Done" and getting nothing back is the only outcome.
  const asksForDone = f.status?.includes("done") ?? false;
  if (f.showCompleted === "false" && !asksForDone) where.push(ne(task.status, "done"));

  const order: SQL[] =
    f.sort === "due"
      ? [sql`${task.dueDate} is null`, asc(task.dueDate)]
      : f.sort === "priority"
        ? [sql`field(${task.priority}, 'urgent', 'high', 'medium', 'low')`, desc(task.createdAt)]
        : f.sort === "updated"
          ? [desc(task.updatedAt)]
          : [desc(task.createdAt)];

  const rows = await db
    .select({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      isPersonal: task.isPersonal,
      completedAt: task.completedAt,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      createdById: task.createdById,
      projectId: task.projectId,
      projectName: project.name,
      projectColor: project.color,
      assigneeId: task.assigneeId,
      assigneeName: user.name,
      assigneeImage: user.image,
    })
    .from(task)
    .leftJoin(project, eq(task.projectId, project.id))
    .leftJoin(user, eq(task.assigneeId, user.id))
    .where(and(...where))
    .orderBy(...order)
    .limit(f.limit);

  res.json({ tasks: rows });
});

const TaskInput = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(10_000).nullable().optional(),
  projectId: z.string().max(36).nullable().optional(),
  status: z.enum(taskStatuses).optional(),
  priority: z.enum(taskPriorities).optional(),
  assigneeId: z.string().max(36).nullable().optional(),
  dueDate: z.iso.datetime().nullable().optional(),
  isPersonal: z.boolean().optional(),
});

/** Rejects references to projects or people outside this team. */
async function assertRefsInTeam(
  teamId: string,
  projectId?: string | null,
  assigneeId?: string | null,
): Promise<void> {
  if (projectId) {
    const [p] = await db
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.id, projectId), eq(project.organizationId, teamId)))
      .limit(1);
    if (!p) throw badRequest("Project is not in this team");
  }
  if (assigneeId) {
    const [m] = await db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.organizationId, teamId), eq(member.userId, assigneeId)))
      .limit(1);
    if (!m) throw badRequest("Assignee is not a member of this team");
  }
}

/** POST /api/tasks */
tasksRouter.post("/", async (req, res, next) => {
  const parsed = TaskInput.safeParse(req.body);
  if (!parsed.success) return next(badRequest(parsed.error.issues[0]?.message));

  const input = parsed.data;
  const isPersonal = input.isPersonal ?? false;

  await assertRefsInTeam(
    req.team.id,
    isPersonal ? null : input.projectId,
    isPersonal ? null : input.assigneeId,
  );

  const row = {
    id: newId(),
    organizationId: req.team.id,
    title: input.title,
    description: input.description ?? null,
    // Personal tasks never belong to a project and are always self-assigned.
    projectId: isPersonal ? null : (input.projectId ?? null),
    status: input.status ?? ("todo" as const),
    priority: input.priority ?? ("medium" as const),
    assigneeId: isPersonal ? req.user.id : (input.assigneeId ?? null),
    createdById: req.user.id,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    isPersonal,
    completedAt: input.status === "done" ? new Date() : null,
  };

  await db.insert(task).values(row);
  res.status(201).json({ task: row });
});

/** Loads a task the caller is allowed to see, or throws 404. */
async function loadVisible(taskId: string, teamId: string, userId: string) {
  const [row] = await db
    .select()
    .from(task)
    .where(and(eq(task.id, taskId), visibleTasks(teamId, userId)))
    .limit(1);
  if (!row) throw notFound("Task not found");
  return row;
}

/** A personal task may only be changed by the person who created it. */
function assertMayEdit(existing: { isPersonal: boolean; createdById: string }, userId: string): void {
  if (existing.isPersonal && existing.createdById !== userId) {
    throw forbidden("This is someone else's personal task");
  }
}

/** PATCH /api/tasks/:id */
tasksRouter.patch("/:id", async (req, res, next) => {
  const parsed = TaskInput.partial().safeParse(req.body);
  if (!parsed.success) return next(badRequest(parsed.error.issues[0]?.message));

  const existing = await loadVisible(param(req.params, "id"), req.team.id, req.user.id);
  assertMayEdit(existing, req.user.id);

  const input = parsed.data;
  await assertRefsInTeam(req.team.id, input.projectId, input.assigneeId);

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.projectId !== undefined) patch.projectId = existing.isPersonal ? null : input.projectId;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.assigneeId !== undefined && !existing.isPersonal) patch.assigneeId = input.assigneeId;
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.status !== undefined) {
    patch.status = input.status;
    patch.completedAt = input.status === "done" ? new Date() : null;
  }

  if (Object.keys(patch).length) {
    await db.update(task).set(patch).where(eq(task.id, existing.id));
  }

  const [row] = await db.select().from(task).where(eq(task.id, existing.id)).limit(1);
  res.json({ task: row });
});

/** POST /api/tasks/:id/toggle — flip between done and todo in one call. */
tasksRouter.post("/:id/toggle", async (req, res) => {
  const existing = await loadVisible(param(req.params, "id"), req.team.id, req.user.id);
  assertMayEdit(existing, req.user.id);

  const done = existing.status !== "done";
  await db
    .update(task)
    .set({ status: done ? "done" : "todo", completedAt: done ? new Date() : null })
    .where(eq(task.id, existing.id));

  const [row] = await db.select().from(task).where(eq(task.id, existing.id)).limit(1);
  res.json({ task: row });
});

/** DELETE /api/tasks/:id */
tasksRouter.delete("/:id", async (req, res) => {
  const existing = await loadVisible(param(req.params, "id"), req.team.id, req.user.id);
  assertMayEdit(existing, req.user.id);

  await db.delete(task).where(eq(task.id, existing.id));
  res.status(204).end();
});
