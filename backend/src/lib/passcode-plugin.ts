import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";

const PASSCODE_PATTERN = /^\d{6}$/;
const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

/**
 * Accounts have no email, but Better Auth's user table requires a unique one,
 * so each account gets a placeholder derived from its username. It is never
 * shown and nothing is ever sent to it.
 */
const PLACEHOLDER_EMAIL_DOMAIN = "taskboard.local";

/** One message for "no such user" and "wrong passcode", so the form can't be used to find accounts. */
const INVALID = "Wrong username or passcode";

/**
 * There is no lockout, so the only brake on guessing a 6-digit passcode is
 * slowing each address down. Twenty tries a minute is invisible to a person
 * and turns a sweep of all million codes into weeks.
 */
const ATTEMPTS_PER_MINUTE = 20;

type PasscodeUser = {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  passcodeHash?: string | null;
  [key: string]: unknown;
};

/** Passcodes anyone would try first: repeats and straight runs. */
export function isGuessablePasscode(passcode: string): boolean {
  if (/^(\d)\1{5}$/.test(passcode)) return true; // 000000, 777777
  const digits = passcode.split("").map(Number);
  const steps = digits.slice(1).map((d, i) => d - digits[i]!);
  return steps.every((s) => s === 1) || steps.every((s) => s === -1); // 123456, 987654
}

function assertUsablePasscode(passcode: string): void {
  if (!PASSCODE_PATTERN.test(passcode)) {
    throw new APIError("BAD_REQUEST", { message: "Passcode must be exactly 6 digits" });
  }
  if (isGuessablePasscode(passcode)) {
    throw new APIError("BAD_REQUEST", {
      message: "That passcode is too easy to guess. Avoid repeats and runs like 123456.",
    });
  }
}

/** The cookie cache embeds the user, so the hash must never ride along. */
function publicUser(user: PasscodeUser) {
  const { passcodeHash: _hash, ...rest } = user;
  return rest;
}

/**
 * Accounts made of a name, a username and a 6-digit passcode — no email, no
 * password. The passcode is hashed with Better Auth's password hasher, marked
 * so no API response returns it and /update-user cannot write it, and can only
 * be changed by someone who knows the current one.
 */
export const passcode = () =>
  ({
    id: "passcode",

    schema: {
      user: {
        fields: {
          passcodeHash: { type: "string", required: false, returned: false, input: false },
        },
      },
    },

    rateLimit: [
      {
        pathMatcher: (path: string) =>
          path === "/sign-in/passcode" || path === "/sign-up/passcode" || path === "/passcode/change",
        window: 60,
        max: ATTEMPTS_PER_MINUTE,
      },
    ],

    endpoints: {
      signUpPasscode: createAuthEndpoint(
        "/sign-up/passcode",
        {
          method: "POST",
          body: z.object({
            name: z.string().trim().min(1, "Enter your name").max(60),
            username: z.string().max(60),
            passcode: z.string().max(12),
          }),
        },
        async (ctx) => {
          const username = ctx.body.username.trim().toLowerCase();
          if (!USERNAME_PATTERN.test(username)) {
            throw new APIError("BAD_REQUEST", {
              message: "Username must be 3–30 letters, numbers, dots or underscores",
            });
          }
          assertUsablePasscode(ctx.body.passcode);

          const taken = await ctx.context.adapter.findOne({
            model: "user",
            where: [{ field: "username", value: username }],
          });
          if (taken) throw new APIError("CONFLICT", { message: "That username is taken" });

          const passcodeHash = await ctx.context.password.hash(ctx.body.passcode);

          let created: PasscodeUser | null;
          try {
            created = (await ctx.context.internalAdapter.createUser({
              name: ctx.body.name,
              email: `${username}@${PLACEHOLDER_EMAIL_DOMAIN}`,
              emailVerified: true,
              username,
              displayUsername: username,
            }, { method: "passcode" })) as PasscodeUser | null;
          } catch (error) {
            // Two people racing for the same username: the unique index decides.
            if (String((error as Error)?.message ?? error).includes("Duplicate")) {
              throw new APIError("CONFLICT", { message: "That username is taken" });
            }
            throw error;
          }
          if (!created) {
            throw new APIError("INTERNAL_SERVER_ERROR", { message: "Could not create the account" });
          }

          // Written through the adapter because the field refuses ordinary input.
          await ctx.context.adapter.update({
            model: "user",
            where: [{ field: "id", value: created.id }],
            update: { passcodeHash },
          });

          const session = await ctx.context.internalAdapter.createSession(created.id);
          if (!session) {
            throw new APIError("INTERNAL_SERVER_ERROR", { message: "Could not start a session" });
          }
          const user = publicUser(created);
          await setSessionCookie(ctx, {
            session,
            user: user as Parameters<typeof setSessionCookie>[1]["user"],
          });

          return ctx.json({
            token: session.token,
            user: { id: user.id, name: user.name, username: user.username ?? username },
          });
        },
      ),

      signInPasscode: createAuthEndpoint(
        "/sign-in/passcode",
        {
          method: "POST",
          body: z.object({
            username: z.string().min(1).max(60),
            passcode: z.string().max(12),
          }),
        },
        async (ctx) => {
          const username = ctx.body.username.trim().toLowerCase();
          const found = (await ctx.context.adapter.findOne({
            model: "user",
            where: [{ field: "username", value: username }],
          })) as PasscodeUser | null;

          if (!found?.passcodeHash) {
            // Hash anyway so an unknown username takes as long as a wrong passcode.
            await ctx.context.password.hash(ctx.body.passcode);
            throw new APIError("UNAUTHORIZED", { message: INVALID });
          }

          const valid =
            PASSCODE_PATTERN.test(ctx.body.passcode) &&
            (await ctx.context.password.verify({
              hash: found.passcodeHash,
              password: ctx.body.passcode,
            }));
          if (!valid) throw new APIError("UNAUTHORIZED", { message: INVALID });

          const session = await ctx.context.internalAdapter.createSession(found.id);
          if (!session) {
            throw new APIError("INTERNAL_SERVER_ERROR", { message: "Could not start a session" });
          }
          const user = publicUser(found);
          await setSessionCookie(ctx, {
            session,
            user: user as Parameters<typeof setSessionCookie>[1]["user"],
          });

          return ctx.json({
            token: session.token,
            user: { id: user.id, name: user.name, username: user.username ?? null },
          });
        },
      ),

      changePasscode: createAuthEndpoint(
        "/passcode/change",
        {
          method: "POST",
          use: [sessionMiddleware],
          body: z.object({
            currentPasscode: z.string().max(12),
            newPasscode: z.string().max(12),
          }),
        },
        async (ctx) => {
          const userId = ctx.context.session.user.id;
          const found = (await ctx.context.adapter.findOne({
            model: "user",
            where: [{ field: "id", value: userId }],
          })) as PasscodeUser | null;

          const currentOk =
            Boolean(found?.passcodeHash) &&
            PASSCODE_PATTERN.test(ctx.body.currentPasscode) &&
            (await ctx.context.password.verify({
              hash: found!.passcodeHash!,
              password: ctx.body.currentPasscode,
            }));
          if (!currentOk) {
            throw new APIError("UNAUTHORIZED", { message: "Your current passcode is wrong" });
          }

          assertUsablePasscode(ctx.body.newPasscode);
          if (ctx.body.newPasscode === ctx.body.currentPasscode) {
            throw new APIError("BAD_REQUEST", { message: "Pick a passcode different from your current one" });
          }

          await ctx.context.adapter.update({
            model: "user",
            where: [{ field: "id", value: userId }],
            update: { passcodeHash: await ctx.context.password.hash(ctx.body.newPasscode) },
          });

          return ctx.json({ ok: true });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
