"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AuthFrame } from "@/components/auth-frame";
import { PinInput } from "@/components/pin-input";
import { Button, Input, Label } from "@/components/ui";
import { passcodeApi } from "@/lib/passcode";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (digits: string) => {
    if (!username.trim() || digits.length !== 6 || busy) return;
    setBusy(true);
    try {
      await passcodeApi.signIn(username.trim(), digits);
      // A full navigation: the auth client only refreshes its session for its
      // own sign-in routes, and this one is custom.
      window.location.assign("/tasks");
    } catch (error) {
      setBusy(false);
      setCode("");
      toast.error(error instanceof Error ? error.message : "Could not sign in");
    }
  };

  return (
    <AuthFrame
      title="Welcome back"
      subtitle="Sign in with your username and 6-digit passcode."
      footer={
        <p className="text-sm text-ink-muted">
          New here?{" "}
          <Link href="/signup" className="font-medium text-signal hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void signIn(code);
        }}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your username"
            required
          />
        </div>
        <div>
          <Label htmlFor="passcode">Passcode</Label>
          <PinInput
            id="passcode"
            value={code}
            onChange={setCode}
            onComplete={signIn}
            masked
            disabled={busy}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={busy || code.length < 6 || !username.trim()}
        >
          {busy ? "Signing in…" : "Sign in"}
          <ArrowRight className="size-4" />
        </Button>
      </form>
    </AuthFrame>
  );
}
