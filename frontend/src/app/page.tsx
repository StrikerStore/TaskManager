"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";

/** Entry point: straight to the task list when signed in, otherwise to login. */
export default function HomePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (isPending) return;
    router.replace(session?.user ? "/tasks" : "/login");
  }, [isPending, session, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="font-display text-3xl tracking-tight">
        Task<span className="italic text-signal">board</span>
      </p>
    </div>
  );
}
