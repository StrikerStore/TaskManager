"use client";

import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * The API is reached through this app's own /api/* (see next.config.ts), so
 * requests are same-origin by default. Set NEXT_PUBLIC_API_URL only to bypass
 * the proxy and call an API on another origin directly.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export const authClient = createAuthClient({
  // Undefined means "this page's own origin", which is where the proxy lives.
  baseURL: API_URL || undefined,
  fetchOptions: { credentials: "include" },
  plugins: [organizationClient()],
});

export const { useSession, signOut } = authClient;

/** The signed-in user's username. The client does not type the plugin field, so read it safely. */
export function usernameOf(user: unknown): string | null {
  const value = (user as { username?: unknown } | null | undefined)?.username;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Turns a Better Auth error payload into something worth showing a person. */
export function authErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
}
