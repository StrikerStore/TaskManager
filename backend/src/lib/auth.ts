import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, username } from "better-auth/plugins";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { env, isProd } from "../env.js";
import { passcode } from "./passcode-plugin.js";

export const auth = betterAuth({
  appName: "TaskBoard",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "mysql", schema }),
  // The frontend runs on a different port/origin than this API.
  trustedOrigins: [env.APP_URL],
  // No email and no passwords: people sign up and in with a username and passcode.
  emailAndPassword: { enabled: false },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  // Better Auth only rate-limits in production by default; the passcode throttle
  // is the main defence against guessing, so it runs everywhere.
  rateLimit: { enabled: true },
  advanced: {
    // Browsers only ever talk to the web app, which forwards /api/* here, so the
    // session cookie is first-party and can stay SameSite=Lax.
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: isProd,
      httpOnly: true,
    },
  },
  plugins: [
    // Supplies the unique `username` column. Its password sign-in goes unused.
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
    }),
    // Sign up and sign in with a name, a username and a 6-digit passcode.
    passcode(),
    // Teams, members and roles. People join through team codes, not invitations.
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: "owner",
    }),
  ],
});

export type Auth = typeof auth;
