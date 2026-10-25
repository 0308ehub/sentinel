"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { syncTheme } from "@/lib/theme";
import { ExperimentProvider } from "@/components/autopilot/experiment-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    syncTheme();
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ExperimentProvider>{children}</ExperimentProvider>
    </QueryClientProvider>
  );
}
