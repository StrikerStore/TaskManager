import { and, eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db } from "../db/index.js";
import { member, organization } from "../db/schema.js";
import { badRequest, forbidden } from "../lib/http.js";

/**
 * Resolves the team for this request from the `x-team-id` header (or `teamId`
 * query param) and verifies the caller is a member of it. Runs after requireAuth.
 */
export async function requireTeam(req: Request, _res: Response, next: NextFunction) {
  const teamId =
    (req.header("x-team-id") ?? (typeof req.query.teamId === "string" ? req.query.teamId : "")).trim();

  if (!teamId) return next(badRequest("Missing team (send an x-team-id header)"));

  const [row] = await db
    .select({
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(and(eq(member.organizationId, teamId), eq(member.userId, req.user.id)))
    .limit(1);

  if (!row) return next(forbidden("You are not a member of this team"));

  req.team = row;
  next();
}

/** Team roles allowed to manage projects and members. */
export function requireTeamAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.team.role !== "owner" && req.team.role !== "admin") {
    return next(forbidden("Only team owners and admins can do this"));
  }
  next();
}
