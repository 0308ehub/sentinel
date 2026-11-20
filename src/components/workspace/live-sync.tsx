"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth, useOrganization } from "@clerk/nextjs";
import { usePathname, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { refreshWorkspaceSync } from "@/lib/workspace/sync-client";
import {
  formatLocation,
  versionChanged,
  type PresenceEntry,
} from "@/lib/workspace/live-sync-core";

const PresenceContext = createContext<PresenceEntry[]>([]);
const VERSION_INTERVAL = 2_000;
const PRESENCE_INTERVAL = 5_000;
const HEARTBEAT_INTERVAL = 15_000;

function useClerkOrganization(): boolean {
  return Boolean(useOrganization().organization);
}

function useLocalOrganization(): boolean {
  return false;
}

function useClerkPollingEnabled(): boolean {
  const { isLoaded, isSignedIn } = useAuth();
  return Boolean(isLoaded && isSignedIn);
}

function useLocalPollingEnabled(): boolean {
  return true;
}

const useHasOrganization = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? useClerkOrganization
  : useLocalOrganization;
const usePollingEnabled = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? useClerkPollingEnabled
  : useLocalPollingEnabled;

export function usePresence(): PresenceEntry[] {
  return useContext(PresenceContext);
}

export function LiveSyncProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasOrganization = useHasOrganization();
  const canPoll = usePollingEnabled();
  const experimentId = searchParams.get("experiment");
  const location = useMemo(() => formatLocation(pathname, experimentId), [experimentId, pathname]);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const previousVersion = useRef<number | null>(null);
  const pollingEnabled = useRef(true);

  useEffect(() => {
    if (!canPoll) return;
    pollingEnabled.current = true;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (disposed || !pollingEnabled.current || document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/workspace/version", { cache: "no-store" });
        if (response.status === 401) {
          pollingEnabled.current = false;
          return;
        }
        if (response.ok) {
          const body = await response.json() as { version?: unknown };
          const next = typeof body.version === "number" ? body.version : Number(body.version);
          if (Number.isSafeInteger(next)) {
            if (versionChanged(previousVersion.current, next)) {
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["autopilot"] }),
                queryClient.invalidateQueries({ queryKey: ["experiment"] }),
                queryClient.invalidateQueries({ queryKey: ["kismet-measure"] }),
                queryClient.invalidateQueries({ queryKey: ["autopilot-spend"] }),
                refreshWorkspaceSync(),
              ]);
            }
            previousVersion.current = next;
          }
        }
      } finally {
        if (!disposed && pollingEnabled.current && document.visibilityState === "visible") {
          timer = setTimeout(poll, VERSION_INTERVAL);
        }
      }
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        if (timer) clearTimeout(timer);
        timer = undefined;
        return;
      }
      if (pollingEnabled.current) void poll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    void poll();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, [canPoll, queryClient]);

  useEffect(() => {
    if (!hasOrganization) return;
    let disposed = false;
    let presenceTimer: ReturnType<typeof setTimeout> | undefined;
    let heartbeatTimer: ReturnType<typeof setTimeout> | undefined;

    const heartbeat = async () => {
      if (disposed) return;
      if (document.visibilityState !== "visible") {
        heartbeatTimer = setTimeout(heartbeat, HEARTBEAT_INTERVAL);
        return;
      }
      await fetch("/api/workspace/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location }),
      }).catch(() => undefined);
      if (!disposed) heartbeatTimer = setTimeout(heartbeat, HEARTBEAT_INTERVAL);
    };
    const readPresence = async () => {
      if (disposed) return;
      if (document.visibilityState !== "visible") {
        presenceTimer = setTimeout(readPresence, PRESENCE_INTERVAL);
        return;
      }
      try {
        const response = await fetch("/api/workspace/presence", { cache: "no-store" });
        if (response.ok) setPresence(await response.json() as PresenceEntry[]);
      } catch {
        // The next presence read is intentionally soon.
      } finally {
        if (!disposed) presenceTimer = setTimeout(readPresence, PRESENCE_INTERVAL);
      }
    };
    void heartbeat();
    void readPresence();
    return () => {
      disposed = true;
      if (presenceTimer) clearTimeout(presenceTimer);
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
    };
  }, [hasOrganization, location]);

  return <PresenceContext.Provider value={hasOrganization ? presence : []}>{children}</PresenceContext.Provider>;
}
