import { and, asc, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { joinRequest, member, organization, teamCode, user } from "../db/schema.js";
import { badRequest, forbidden, HttpError, notFound, param } from "../lib/http.js";
import { newId, newTeamCode, normalizeTeamCode } from "../lib/ids.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireTeam, requireTeamAdmin } from "../middleware/require-team.js";

export const teamsRouter = Router();

const conflict = (message: string) => new HttpError(409, message);

function isDuplicateKey(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "ER_DUP_ENTRY" || e?.cause?.code === "ER_DUP_ENTRY";
}

async function isMember(teamId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, teamId), eq(member.userId, userId)))
    .limit(1);
  return Boolean(row);
}

/** The team's join code, created the first time an owner or admin asks for it. */
async function getOrCreateCode(teamId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const [existing] = await db
      .select({ code: teamCode.code })
      .from(teamCode)
      .where(eq(teamCode.organizationId, teamId))
      .limit(1);
    if (existing) return existing.code;

    try {
      const code = newTeamCode();
      await db.insert(teamCode).values({ organizationId: teamId, code });
      return code;
    } catch (error) {
      // The code collided, or a parallel request created the row first: look again.
      if (!isDuplicateKey(error)) throw error;
    }
  }
  throw new Error("Could not create a team code");
}

/* -------------------------------------------------- the person asking to join */

/** POST /api/teams/join — ask to join the team that owns this code. */
teamsRouter.post("/join", requireAuth, async (req, res, next) => {
  const parsed = z.object({ code: z.string().min(1).max(20) }).safeParse(req.body);
  if (!parsed.success) return next(badRequest("Enter a team code"));

  const code = normalizeTeamCode(parsed.data.code);
  const [team] = await db
    .select({ id: organization.id, name: organization.name })
    .from(teamCode)
    .innerJoin(organization, eq(teamCode.organizationId, organization.id))
    .where(eq(teamCode.code, code))
    .limit(1);

  if (!team) return next(notFound("No team uses that code. Check it with the team owner."));
  if (await isMember(team.id, req.user.id)) return next(conflict(`You're already in ${team.name}`));

  const [pending] = await db
    .select({ id: joinRequest.id, createdAt: joinRequest.createdAt })
    .from(joinRequest)
    .where(
      and(
        eq(joinRequest.organizationId, team.id),
        eq(joinRequest.userId, req.user.id),
        eq(joinRequest.status, "pending"),
      ),
    )
    .limit(1);

  if (pending) {
    // Asking twice keeps the one request rather than queueing duplicates.
    res.json({
      request: {
        id: pending.id,
        teamId: team.id,
        teamName: team.name,
        status: "pending",
        createdAt: pending.createdAt,
      },
    });
    return;
  }

  const id = newId();
  await db
    .insert(joinRequest)
    .values({ id, organizationId: team.id, userId: req.user.id, status: "pending" });

  res.status(201).json({
    request: { id, teamId: team.id, teamName: team.name, status: "pending", createdAt: new Date() },
  });
});

/** GET /api/teams/my-requests — your own requests, newest first. */
teamsRouter.get("/my-requests", requireAuth, async (req, res) => {
  const requests = await db
    .select({
      id: joinRequest.id,
      teamId: organization.id,
      teamName: organization.name,
      status: joinRequest.status,
      createdAt: joinRequest.createdAt,
    })
    .from(joinRequest)
    .innerJoin(organization, eq(joinRequest.organizationId, organization.id))
    .where(eq(joinRequest.userId, req.user.id))
    .orderBy(desc(joinRequest.createdAt))
    .limit(20);

  res.json({ requests });
});

/** DELETE /api/teams/my-requests/:id — withdraw a request that is still pending. */
teamsRouter.delete("/my-requests/:id", requireAuth, async (req, res, next) => {
  const result = await db
    .delete(joinRequest)
    .where(
      and(
        eq(joinRequest.id, param(req.params, "id")),
        eq(joinRequest.userId, req.user.id),
        eq(joinRequest.status, "pending"),
      ),
    );
  if (result[0].affectedRows === 0) return next(notFound("Request not found"));
  res.status(204).end();
});

/* ------------------------------------------------------------ team members */

/** GET /api/teams/members — everyone in the team, by name and username. */
teamsRouter.get("/members", requireAuth, requireTeam, async (req, res) => {
  const rows = await db
    .select({
      id: member.id,
      userId: member.userId,
      role: member.role,
      name: user.name,
      username: user.username,
      image: user.image,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, req.team.id))
    .orderBy(asc(member.createdAt));

  res.json({
    members: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      role: r.role,
      user: { id: r.userId, name: r.name, username: r.username, image: r.image },
    })),
  });
});

/** DELETE /api/teams/members/:userId — owners remove anyone but owners; admins remove members. */
teamsRouter.delete(
  "/members/:userId",
  requireAuth,
  requireTeam,
  requireTeamAdmin,
  async (req, res, next) => {
    const userId = param(req.params, "userId");
    if (userId === req.user.id) return next(badRequest("You can't remove yourself"));

    const [target] = await db
      .select({ id: member.id, role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, req.team.id), eq(member.userId, userId)))
      .limit(1);

    if (!target) return next(notFound("Not a member of this team"));
    if (target.role === "owner") return next(forbidden("An owner can't be removed"));
    if (target.role === "admin" && req.team.role !== "owner") {
      return next(forbidden("Only an owner can remove an admin"));
    }

    await db.delete(member).where(eq(member.id, target.id));
    res.status(204).end();
  },
);

/* ------------------------------------------------------ owner & admin tools */

/** GET /api/teams/code */
teamsRouter.get("/code", requireAuth, requireTeam, requireTeamAdmin, async (req, res) => {
  res.json({ code: await getOrCreateCode(req.team.id) });
});

/** POST /api/teams/code/rotate — the old code stops working immediately. */
teamsRouter.post("/code/rotate", requireAuth, requireTeam, requireTeamAdmin, async (req, res) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newTeamCode();
    try {
      const result = await db
        .update(teamCode)
        .set({ code })
        .where(eq(teamCode.organizationId, req.team.id));
      if (result[0].affectedRows === 0) {
        await db.insert(teamCode).values({ organizationId: req.team.id, code });
      }
      res.json({ code });
      return;
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  }
  throw new Error("Could not issue a new team code");
});

/** GET /api/teams/requests — people waiting to be let in. */
teamsRouter.get("/requests", requireAuth, requireTeam, requireTeamAdmin, async (req, res) => {
  const rows = await db
    .select({
      id: joinRequest.id,
      createdAt: joinRequest.createdAt,
      userId: user.id,
      name: user.name,
      username: user.username,
    })
    .from(joinRequest)
    .innerJoin(user, eq(joinRequest.userId, user.id))
    .where(and(eq(joinRequest.organizationId, req.team.id), eq(joinRequest.status, "pending")))
    .orderBy(asc(joinRequest.createdAt));

  res.json({
    requests: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      user: { id: r.userId, name: r.name, username: r.username },
    })),
  });
});

/**
 * Accept or reject in one transaction. The status update only matches a
 * pending row, so two owners clicking at once cannot both decide it — and an
 * acceptance that loses that race rolls back the membership it added.
 */
async function decide(
  teamId: string,
  requestId: string,
  deciderId: string,
  decision: "accepted" | "rejected",
): Promise<void> {
  const [request] = await db
    .select()
    .from(joinRequest)
    .where(and(eq(joinRequest.id, requestId), eq(joinRequest.organizationId, teamId)))
    .limit(1);

  if (!request) throw notFound("Request not found");
  if (request.status !== "pending") throw conflict(`This request was already ${request.status}`);

  await db.transaction(async (tx) => {
    const result = await tx
      .update(joinRequest)
      .set({ status: decision, decidedById: deciderId, decidedAt: new Date() })
      .where(and(eq(joinRequest.id, request.id), eq(joinRequest.status, "pending")));
    if (result[0].affectedRows === 0) throw conflict("This request was already decided");

    if (decision === "accepted") {
      const [already] = await tx
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.organizationId, teamId), eq(member.userId, request.userId)))
        .limit(1);
      if (!already) {
        await tx.insert(member).values({
          id: newId(),
          organizationId: teamId,
          userId: request.userId,
          role: "member",
          createdAt: new Date(),
        });
      }
    }
  });
}

/** POST /api/teams/requests/:id/accept */
teamsRouter.post(
  "/requests/:id/accept",
  requireAuth,
  requireTeam,
  requireTeamAdmin,
  async (req, res) => {
    await decide(req.team.id, param(req.params, "id"), req.user.id, "accepted");
    res.json({ ok: true });
  },
);

/** POST /api/teams/requests/:id/reject */
teamsRouter.post(
  "/requests/:id/reject",
  requireAuth,
  requireTeam,
  requireTeamAdmin,
  async (req, res) => {
    await decide(req.team.id, param(req.params, "id"), req.user.id, "rejected");
    res.json({ ok: true });
  },
);
