import { and, asc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import {
  member,
  project,
  recurrenceFrequencies,
  recurringTask,
  taskPriorities,
  user,
} from "../db/schema.js";
import { badRequest, notFound, param } from "../lib/http.js";
import { newId } from "../lib/ids.js";
import {
  computeNextRun,
  describeRecurrence,
  parseDays,
  serializeDays,
} from "../lib/recurrence.js";
import { runRecurringRule } from "../lib/scheduler.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireTeam } from "../middleware/require-team.js";

export const recurringRouter = Router();
recurringRouter.use(requireAuth, requireTeam);

const RuleInput = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(10_000).nullable().optional(),
  projectId: z.string().max(36).nullable().optional(),
  priority: z.enum(taskPriorities).optional(),
  assigneeId: z.string().max(36),
  isPersonal: z.boolean().optional(),
  frequency: z.enum(recurrenceFrequencies),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).nullable().optional(),
  monthDays: z.array(z.number().int().min(1).max(31)).min(1).max(31).nullable().optional(),
  triggerTime: z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:MM"),
  dueOffsetDays: z.number().int().min(0).max(365).optional(),
  active: z.boolean().optional(),
});

/** Weekly rules need at least one weekday, monthly rules at least one day of the month. */
function requireShapeFor(input: {
  frequency: (typeof recurrenceFrequencies)[number];
  weekdays?: number[] | null;
  monthDays?: number[] | null;
}): void {
  if (
    (input.frequency === "weekly" || input.frequency === "biweekly") &&
    !input.weekdays?.length
  ) {
    throw badRequest("Pick at least one day of the week");
  }
  if (input.frequency === "monthly" && !input.monthDays?.length) {
    throw badRequest("Pick at least one day of the month");
  }
}

async function assertRefsInTeam(
  teamId: string,
  projectId: string | null | undefined,
  assigneeId: string,
): Promise<void> {
  if (projectId) {
    const [p] = await db
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.id, projectId), eq(project.organizationId, teamId)))
      .limit(1);
    if (!p) throw badRequest("Project is not in this team");
  }
  const [m] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, teamId), eq(member.userId, assigneeId)))
    .limit(1);
  if (!m) throw badRequest("Assignee is not a member of this team");
}

/** GET /api/recurring — the team's rules, plus the caller's personal ones. */
recurringRouter.get("/", async (req, res) => {
  const rows = await db
    .select({
      id: recurringTask.id,
      title: recurringTask.title,
      description: recurringTask.description,
      priority: recurringTask.priority,
      isPersonal: recurringTask.isPersonal,
      frequency: recurringTask.frequency,
      weekdays: recurringTask.weekdays,
      monthDays: recurringTask.monthDays,
      triggerTime: recurringTask.triggerTime,
      dueOffsetDays: recurringTask.dueOffsetDays,
      active: recurringTask.active,
      nextRunAt: recurringTask.nextRunAt,
      lastRunAt: recurringTask.lastRunAt,
      createdById: recurringTask.createdById,
      projectId: recurringTask.projectId,
      projectName: project.name,
      projectColor: project.color,
      assigneeId: recurringTask.assigneeId,
      assigneeName: user.name,
      assigneeImage: user.image,
    })
    .from(recurringTask)
    .leftJoin(project, eq(recurringTask.projectId, project.id))
    .leftJoin(user, eq(recurringTask.assigneeId, user.id))
    .where(eq(recurringTask.organizationId, req.team.id))
    .orderBy(asc(recurringTask.nextRunAt));

  // Personal rules belong to whoever wrote them, like personal tasks.
  const visible = rows.filter((r) => !r.isPersonal || r.createdById === req.user.id);

  res.json({
    rules: visible.map((row) => {
      const weekdays = parseDays(row.weekdays);
      const monthDays = parseDays(row.monthDays);
      return {
        ...row,
        weekdays,
        monthDays,
        // One implementation of the wording, so the UI cannot drift from it.
        summary: describeRecurrence({
          frequency: row.frequency,
          weekdays,
          monthDays,
          triggerTime: row.triggerTime,
        }),
      };
    }),
  });
});

/** POST /api/recurring */
recurringRouter.post("/", async (req, res, next) => {
  const parsed = RuleInput.safeParse(req.body);
  if (!parsed.success) return next(badRequest(parsed.error.issues[0]?.message));

  const input = parsed.data;
  requireShapeFor(input);

  const isPersonal = input.isPersonal ?? false;
  // A personal rule has no project and always belongs to its author.
  const assigneeId = isPersonal ? req.user.id : input.assigneeId;
  await assertRefsInTeam(req.team.id, isPersonal ? null : input.projectId, assigneeId);

  const weekdays = input.weekdays ?? null;
  const monthDays = input.monthDays ?? null;

  const row = {
    id: newId(),
    organizationId: req.team.id,
    title: input.title,
    description: input.description ?? null,
    projectId: isPersonal ? null : (input.projectId ?? null),
    priority: input.priority ?? ("medium" as const),
    assigneeId,
    createdById: req.user.id,
    isPersonal,
    frequency: input.frequency,
    weekdays: serializeDays(weekdays),
    monthDays: serializeDays(monthDays),
    triggerTime: input.triggerTime,
    dueOffsetDays: input.dueOffsetDays ?? 0,
    active: input.active ?? true,
    nextRunAt: computeNextRun({
      frequency: input.frequency,
      weekdays,
      monthDays,
      triggerTime: input.triggerTime,
    }),
    lastRunAt: null,
  };

  await db.insert(recurringTask).values(row);

  res.status(201).json({
    rule: {
      ...row,
      weekdays: weekdays ?? [],
      monthDays: monthDays ?? [],
      summary: describeRecurrence({
        frequency: input.frequency,
        weekdays,
        monthDays,
        triggerTime: input.triggerTime,
      }),
    },
  });
});

/** Loads a rule the caller may act on. */
async function loadRule(id: string, teamId: string, userId: string) {
  const [row] = await db
    .select()
    .from(recurringTask)
    .where(and(eq(recurringTask.id, id), eq(recurringTask.organizationId, teamId)))
    .limit(1);
  if (!row) throw notFound("Recurring task not found");
  if (row.isPersonal && row.createdById !== userId) {
    throw notFound("Recurring task not found");
  }
  return row;
}

/** PATCH /api/recurring/:id */
recurringRouter.patch("/:id", async (req, res, next) => {
  const parsed = RuleInput.partial().safeParse(req.body);
  if (!parsed.success) return next(badRequest(parsed.error.issues[0]?.message));

  const id = param(req.params, "id");
  const existing = await loadRule(id, req.team.id, req.user.id);
  const input = parsed.data;

  // A supplied day set replaces the old one wholesale.
  const merged = {
    frequency: input.frequency ?? existing.frequency,
    weekdays: input.weekdays !== undefined ? input.weekdays : parseDays(existing.weekdays),
    monthDays: input.monthDays !== undefined ? input.monthDays : parseDays(existing.monthDays),
    triggerTime: input.triggerTime ?? existing.triggerTime,
  };
  requireShapeFor(merged);

  if (input.assigneeId || input.projectId !== undefined) {
    await assertRefsInTeam(
      req.team.id,
      existing.isPersonal ? null : (input.projectId ?? existing.projectId),
      input.assigneeId ?? existing.assigneeId,
    );
  }

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.dueOffsetDays !== undefined) patch.dueOffsetDays = input.dueOffsetDays;
  if (input.active !== undefined) patch.active = input.active;
  if (!existing.isPersonal) {
    if (input.projectId !== undefined) patch.projectId = input.projectId;
    if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId;
  }

  // Any change to the schedule shifts the next run.
  const scheduleChanged =
    input.frequency !== undefined ||
    input.weekdays !== undefined ||
    input.monthDays !== undefined ||
    input.triggerTime !== undefined ||
    input.active === true;

  if (scheduleChanged) {
    patch.frequency = merged.frequency;
    patch.weekdays = serializeDays(merged.weekdays);
    patch.monthDays = serializeDays(merged.monthDays);
    patch.triggerTime = merged.triggerTime;
    // Biweekly parity stays tied to when the rule was written, not to edits.
    patch.nextRunAt = computeNextRun({ ...merged, anchor: existing.createdAt });
  }

  if (Object.keys(patch).length) {
    await db.update(recurringTask).set(patch).where(eq(recurringTask.id, existing.id));
  }

  const [row] = await db
    .select()
    .from(recurringTask)
    .where(eq(recurringTask.id, existing.id))
    .limit(1);

  const weekdays = parseDays(row!.weekdays);
  const monthDays = parseDays(row!.monthDays);

  res.json({
    rule: {
      ...row,
      weekdays,
      monthDays,
      summary: describeRecurrence({
        frequency: row!.frequency,
        weekdays,
        monthDays,
        triggerTime: row!.triggerTime,
      }),
    },
  });
});

/** POST /api/recurring/:id/run-now — create one task immediately, without waiting. */
recurringRouter.post("/:id/run-now", async (req, res) => {
  const id = param(req.params, "id");
  const existing = await loadRule(id, req.team.id, req.user.id);
  const task = await runRecurringRule(existing);
  res.status(201).json({ task });
});

/** DELETE /api/recurring/:id */
recurringRouter.delete("/:id", async (req, res) => {
  const id = param(req.params, "id");
  const existing = await loadRule(id, req.team.id, req.user.id);
  await db.delete(recurringTask).where(eq(recurringTask.id, existing.id));
  res.status(204).end();
});
