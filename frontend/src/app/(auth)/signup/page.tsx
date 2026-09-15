"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AuthFrame } from "@/components/auth-frame";
import { PinInput } from "@/components/pin-input";
import { Button, Input, Label } from "@/components/ui";
import { passcodeApi } from "@/lib/passcode";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);

  const mismatch = repeat.length === 6 && passcode !== repeat;
  const canSubmit =
    name.trim().length > 0 &&
    username.length >= 3 &&
    passcode.length === 6 &&
    passcode === repeat &&
    !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await passcodeApi.signUp(name.trim(), username, passcode);
      // Next: create a team or ask to join one.
      window.location.assign("/onboarding");
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : "Could not create the account");
    }
  };

  return (
    <AuthFrame
      title="Create your account"
      subtitle="Just a name, a username and a 6-digit passcode. No email, no password."
      footer={
        <p className="text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-signal hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            autoComplete="name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={60}
            required
          />
        </div>

        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoCapitalize="none"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
            placeholder="Choose a username"
            minLength={3}
            maxLength={30}
            required
          />
          <p className="mt-1 font-mono text-[11px] text-ink-muted">
            3–30 characters: letters, numbers, dot and underscore. This is how you sign in.
          </p>
        </div>

        <div>
          <Label htmlFor="passcode">Passcode</Label>
          <PinInput id="passcode" value={passcode} onChange={setPasscode} masked ariaLabel="Passcode" />
        </div>

        <div>
          <Label htmlFor="repeat">Repeat passcode</Label>
          <PinInput id="repeat" value={repeat} onChange={setRepeat} masked ariaLabel="Repeat passcode" />
          {mismatch ? (
            <p className="mt-2 font-mono text-[11px] text-urgent">The two passcodes don&apos;t match.</p>
          ) : (
            <p className="mt-2 font-mono text-[11px] text-ink-muted">
              Avoid repeats and runs — 111111 and 123456 aren&apos;t allowed.
            </p>
          )}
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={!canSubmit}>
          {busy ? "Creating…" : "Create account"}
          <ArrowRight className="size-4" />
        </Button>
      </form>
    </AuthFrame>
  );
}
