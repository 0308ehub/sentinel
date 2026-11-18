"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { armFor, type Arm, type FlagState } from "@/lib/autopilot/assign";
import { hasPreviewOverrides, previewOverridesForPage, type PreviewOverrides } from "@/lib/autopilot/preview";
import { ExperimentContext } from "@/lib/autopilot/variant";

const VISITOR_COOKIE = "kismet_vid";
const FLUSH_MS = 4000;
const PREVIEW_KEY = "kismet-preview";

interface TrackedEvent {
  name: "view" | "click";
  page: string;
  element: string;
  arms: Record<string, Arm>;
}

function readVisitor(): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${VISITOR_COOKIE}=([^;]+)`));
  if (match) return decodeURIComponent(match[1]);
  const id = crypto.randomUUID();
  document.cookie = `${VISITOR_COOKIE}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  return id;
}

function labelFor(target: Element): string | null {
  const el = target.closest("[data-track], button, a, [role='button'], [role='menuitem'], [role='option']");
  if (!el) return null;
  const label =
    el.getAttribute("data-track") || el.getAttribute("aria-label") || (el.textContent ?? "").replace(/\s+/g, " ").trim();
  return label ? label.slice(0, 80) : null;
}

/** Assigns this visitor to running experiments and records page views and clicks for Kismet. */
export function ExperimentProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visitor] = useState(() => (typeof document === "undefined" ? "" : readVisitor()));
  const queue = useRef<TrackedEvent[]>([]);
  const [overrides, setOverrides] = useState<PreviewOverrides>({});
  const [embedded, setEmbedded] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("kismet_preview");
    const isEmbedded = params.get("kismet_embed") === "1";
    let stored: string | null = null;
    try {
      if (!isEmbedded) stored = sessionStorage.getItem(PREVIEW_KEY);
    } catch {
      // Storage may be blocked.
    }
    const next = previewOverridesForPage(requested, isEmbedded, stored);
    if (!isEmbedded) {
      try {
        if (next.stored) sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(next.stored));
        else sessionStorage.removeItem(PREVIEW_KEY);
      } catch {}
    }
    const timer = window.setTimeout(() => {
      setOverrides(next.overrides);
      setEmbedded(isEmbedded);
      setPreviewReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const previewing = hasPreviewOverrides(overrides);

  const flags = useQuery({
    queryKey: ["autopilot-flags"],
    queryFn: async () => {
      const res = await fetch("/api/autopilot/flags", { cache: "no-store" });
      if (!res.ok) return [] as FlagState[];
      return ((await res.json()) as { flags: FlagState[] }).flags;
    },
    staleTime: 5 * 60 * 1000,
  });

  const arms = useMemo(() => {
    const result: Record<string, Arm> = {};
    if (!visitor) return result;
    for (const flag of flags.data ?? []) {
      const arm = armFor(visitor, flag);
      if (arm) result[flag.key] = arm;
    }
    Object.assign(result, overrides);
    return result;
  }, [flags.data, overrides, visitor]);

  const armsRef = useRef(arms);
  useEffect(() => {
    armsRef.current = arms;
  }, [arms]);

  // Wait for the flags so each view is tagged with the experiments this visitor is in.
  const flagsReady = flags.isFetched;
  useEffect(() => {
    if (!visitor || !pathname || !flagsReady || !previewReady || previewing) return;
    queue.current.push({ name: "view", page: pathname, element: "", arms: armsRef.current });
  }, [pathname, visitor, flagsReady, previewReady, previewing]);

  useEffect(() => {
    if (!visitor || !previewReady || previewing) {
      queue.current = [];
      return;
    }
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const label = labelFor(event.target);
      if (label) queue.current.push({ name: "click", page: window.location.pathname, element: label, arms: armsRef.current });
    };
    const flush = () => {
      if (queue.current.length === 0) return;
      const events = queue.current.splice(0, 50);
      const body = JSON.stringify({ visitor, events });
      if (document.visibilityState === "hidden" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/autopilot/events", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/autopilot/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(
          () => {}
        );
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("visibilitychange", onHide);
    const timer = setInterval(flush, FLUSH_MS);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("visibilitychange", onHide);
      clearInterval(timer);
      flush();
    };
  }, [previewReady, previewing, visitor]);

  const value = useMemo(() => ({ visitor, arms }), [visitor, arms]);
  const previewArm = Object.values(overrides)[0];
  return (
    <ExperimentContext.Provider value={value}>
      {children}
      {previewing && !embedded && previewArm && (
        <div className="fixed bottom-4 left-4 z-[100] flex items-center gap-2 rounded-full border border-[#c7d7fe] bg-white px-3 py-1.5 text-xs text-[#374151] shadow-md">
          <span>Previewing: {previewArm} version</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => {
              try { sessionStorage.removeItem(PREVIEW_KEY); } catch {}
              const url = new URL(window.location.href);
              url.searchParams.delete("kismet_preview");
              window.location.replace(url.toString());
            }}
          >
            Exit
          </button>
        </div>
      )}
    </ExperimentContext.Provider>
  );
}
