import { and, asc, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { project, task } from "../db/schema.js";
import { badRequest, notFound, param } from "../lib/http.js";
import { newId } from "../lib/ids.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireTeam, requireTeamAdmin } from "../middleware/require-team.js";

export const projectsRouter = Router();
projectsRouter.use(requireAuth, requireTeam);

const ProjectInput = z.object({
  name: z.string().trim().min(1).max(120),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "color must be a hex value like #6366f1")
    .optional(),
});

/** GET /api/projects -> projects in the team, each with its open task count. */
projectsRouter.get("/", async (req, res) => {
  const includeArchived = req.query.includeArchived === "true";

  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      color: project.color,
      archived: project.archived,
      createdAt: project.createdAt,
      openCount: sql<number>`(
        select count(*) from ${task}
        where ${task.projectId} = ${project.id}
          and ${task.status} <> 'done'
          and ${task.isPersonal} = false
      )`.mapWith(Number),
    })
    .from(project)
    .where(
      includeArchived
        ? eq(project.organizationId, req.team.id)
        : and(eq(project.organizationId, req.team.id), eq(project.archived, false)),
    )
    .orderBy(asc(project.name));

  res.json({ projects: rows });
});

/** POST /api/projects */
projectsRouter.post("/", async (req, res, next) => {
  const parsed = ProjectInput.safeParse(req.body);
  if (!parsed.success) return next(badRequest(parsed.error.issues[0]?.message));

  const row = {
    id: newId(),
    organizationId: req.team.id,
    name: parsed.data.name,
    color: parsed.data.color ?? "#6366f1",
    archived: false,
    createdById: req.user.id,
  };
  await db.insert(project).values(row);
  res.status(201).json({ project: { ...row, openCount: 0 } });
});

/** PATCH /api/projects/:id */
projectsRouter.patch("/:id", async (req, res, next) => {
  const parsed = ProjectInput.partial().extend({ archived: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) return next(badRequest(parsed.error.issues[0]?.message));

  const result = await db
    .update(project)
    .set(parsed.data)
    .where(and(eq(project.id, param(req.params, "id")), eq(project.organizationId, req.team.id)));

  if (result[0].affectedRows === 0) return next(notFound("Project not found"));

  const [row] = await db.select().from(project).where(eq(project.id, param(req.params, "id"))).limit(1);
  res.json({ project: row });
});

/** DELETE /api/projects/:id — owners/admins only. Tasks survive, unlinked. */
projectsRouter.delete("/:id", requireTeamAdmin, async (req, res, next) => {
  const result = await db
    .delete(project)
    .where(and(eq(project.id, param(req.params, "id")), eq(project.organizationId, req.team.id)));

  if (result[0].affectedRows === 0) return next(notFound("Project not found"));
  res.status(204).end();
});
