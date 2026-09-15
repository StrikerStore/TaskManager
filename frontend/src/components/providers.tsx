"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { ConfirmProvider } from "@/components/confirm";
import { TeamProvider } from "@/components/team-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <TeamProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </TeamProvider>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "var(--paper-raised)",
            color: "var(--ink)",
            border: "1px solid var(--rule-strong)",
            borderRadius: "10px",
            fontFamily: "var(--font-plex-sans)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
