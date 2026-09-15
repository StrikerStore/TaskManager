"use client";

import { Hash } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PinInput } from "@/components/pin-input";
import { Avatar, Button, Label } from "@/components/ui";
import { useSession, usernameOf } from "@/lib/auth-client";
import { passcodeApi } from "@/lib/passcode";

export default function AccountPage() {
  const { data: session } = useSession();
  const username = usernameOf(session?.user);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);

  const mismatch = repeat.length === 6 && next !== repeat;
  const canSave = current.length === 6 && next.length === 6 && next === repeat && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await passcodeApi.change(current, next);
      toast.success("Passcode changed — use the new one next time you sign in");
      setCurrent("");
      setNext("");
      setRepeat("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change the passcode");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-5 md:px-6 md:py-8">
      <h1 className="font-display text-3xl leading-none tracking-tight md:text-4xl">Account</h1>

      {session?.user && (
        <div className="mt-6 flex items-center gap-3 rounded-[10px] border border-rule-strong bg-raised p-3 md:p-4">
          <Avatar name={session.user.name} image={session.user.image} size={40} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-ink">{session.user.name}</p>
            {username && <p className="truncate font-mono text-[12px] text-ink-muted">@{username}</p>}
          </div>
        </div>
      )}

      <section className="mt-6 rounded-[10px] border border-rule-strong bg-raised p-3 md:p-4">
        <h2 className="flex items-center gap-2 font-display text-2xl leading-none text-ink">
          <Hash className="size-5 text-signal" />
          Change passcode
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Your passcode is the only way into your account, so keep it somewhere safe.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <Label htmlFor="current-pin">Current passcode</Label>
            <PinInput id="current-pin" value={current} onChange={setCurrent} masked ariaLabel="Current passcode" />
          </div>
          <div>
            <Label htmlFor="new-pin">New passcode</Label>
            <PinInput id="new-pin" value={next} onChange={setNext} masked ariaLabel="New passcode" />
          </div>
          <div>
            <Label htmlFor="repeat-pin">Repeat new passcode</Label>
            <PinInput id="repeat-pin" value={repeat} onChange={setRepeat} masked ariaLabel="Repeat new passcode" />
            {mismatch ? (
              <p className="mt-2 font-mono text-[11px] text-urgent">The two passcodes don&apos;t match.</p>
            ) : (
              <p className="mt-2 font-mono text-[11px] text-ink-muted">
                Avoid repeats and runs — 111111 and 123456 aren&apos;t allowed.
              </p>
            )}
          </div>

          <div className="flex justify-end border-t border-rule pt-3">
            <Button variant="primary" onClick={save} disabled={!canSave}>
              {busy ? "Saving…" : "Change passcode"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
