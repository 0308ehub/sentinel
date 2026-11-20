"use client";

import { useQuery } from "@tanstack/react-query";
import type { AutopilotState } from "@/lib/autopilot/types";

const ACTIVE_REFRESH_MS = 4000;
const IDLE_REFRESH_MS = 60_000;

function isActive(state: AutopilotState | undefined): boolean {
  return Boolean(state?.experiments.some((experiment) =>
    experiment.status === "building" || experiment.cleanup?.status === "building",
  ));
}

/** The shared experiments inbox. The sidebar and the dashboard read the same cache. */
export function useAutopilot() {
  return useQuery({
    queryKey: ["autopilot"],
    queryFn: async () => {
      const res = await fetch("/api/autopilot", { cache: "no-store" });
      return (await res.json()) as AutopilotState;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (current) => (isActive(current.state.data) ? ACTIVE_REFRESH_MS : IDLE_REFRESH_MS),
  });
}
