import { API_URL } from "./auth-client";

type AuthUser = { id: string; name: string; username: string | null };

/**
 * Calls for the passcode endpoints on the API's Better Auth plugin. Plain fetch
 * rather than the auth client: these paths are ours, so it has no typed methods.
 */
async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api/auth${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as { message?: string } & T;
  if (!res.ok) throw new Error(data.message ?? "Something went wrong");
  return data;
}

export const passcodeApi = {
  signUp: (name: string, username: string, passcode: string) =>
    call<{ token: string; user: AuthUser }>("/sign-up/passcode", { name, username, passcode }),

  signIn: (username: string, passcode: string) =>
    call<{ token: string; user: AuthUser }>("/sign-in/passcode", { username, passcode }),

  change: (currentPasscode: string, newPasscode: string) =>
    call<{ ok: true }>("/passcode/change", { currentPasscode, newPasscode }),
};
