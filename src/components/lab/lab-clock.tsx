"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Pause, Play, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pauseLab, playLab, setLabSpeed, skipToNextEvent, startLabClock, useLabStore } from "@/lib/lab/store";
import { useNotificationStore } from "@/stores/notification-store";
import type { LabExperiment } from "@/lib/lab/advance";

interface LabToast {
  id: string;
  experimentId: string;
  title: string;
  body: string;
}

function needsYou(experiment: LabExperiment) {
  return (
    (experiment.stage === "designed" && Boolean(experiment.design)) ||
    (experiment.stage === "shipping" && experiment.ship?.status === "awaiting")
  );
}

function LabNotifications() {
  const state = useLabStore();
  const router = useRouter();
  const addNotification = useNotificationStore((store) => store.addNotification);
  const initialized = useRef(false);
  const seenUpdates = useRef(new Set<string>());
  const seenNeeds = useRef(new Set<string>());
  const [toasts, setToasts] = useState<LabToast[]>([]);
  useEffect(() => {
    if (!initialized.current) {
      if (!state.experiments.length) return;
      initialized.current = true;
      state.feed.forEach((update) => seenUpdates.current.add(update.id));
      state.experiments.filter(needsYou).forEach((experiment) => seenNeeds.current.add(experiment.id));
      return;
    }
    const next: LabToast[] = [];
    for (const update of state.feed) {
      if (seenUpdates.current.has(update.id)) continue;
      seenUpdates.current.add(update.id);
      if (update.kind !== "decision") continue;
      const experiment = state.experiments.find((item) =>
        item.updates.some((itemUpdate) => itemUpdate.id === update.id),
      );
      if (experiment) next.push({ id: update.id, experimentId: experiment.id, title: update.title, body: update.body });
    }
    for (const experiment of state.experiments) {
      if (!needsYou(experiment) || seenNeeds.current.has(experiment.id)) continue;
      seenNeeds.current.add(experiment.id);
      next.push({
        id: `${experiment.id}-needs-you`,
        experimentId: experiment.id,
        title: "Needs your review",
        body:
          experiment.stage === "shipping"
            ? "The ship change is ready to approve."
            : "The experiment design is ready to launch.",
      });
    }
    if (!next.length) return;
    const unique = next.filter((toast, index) => next.findIndex((item) => item.id === toast.id) === index);
    const showTimer = window.setTimeout(() => setToasts((current) => [...unique, ...current].slice(0, 3)), 0);
    unique.forEach((toast) =>
      addNotification({
        id: `lab-${toast.id}`,
        title: toast.title,
        description: toast.body,
        type: toast.title === "Ready for review" ? "success" : "info",
        read: false,
        timestamp: new Date().toISOString(),
      }),
    );
    const timers = unique.map((toast) =>
      window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), 6000),
    );
    return () => {
      window.clearTimeout(showTimer);
      timers.forEach(window.clearTimeout);
    };
  }, [addNotification, state.experiments, state.feed]);
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => router.push(`/experiments/${toast.experimentId}`)}
          className="pointer-events-auto relative rounded-md border bg-popover p-3 pr-9 text-left shadow-lg motion-safe:animate-in motion-safe:slide-in-from-bottom-2"
        >
          <b className="text-sm">{toast.title}</b>
          <p className="mt-1 text-xs text-muted-foreground">{toast.body}</p>
          <span
            role="button"
            aria-label="Dismiss notification"
            onClick={(event) => {
              event.stopPropagation();
              setToasts((current) => current.filter((item) => item.id !== toast.id));
            }}
            className="absolute right-2 top-2 rounded p-1 hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        </button>
      ))}
    </div>
  );
}
export function LabClock({ children }: { children?: React.ReactNode }) {
  useEffect(() => startLabClock(), []);
  return (
    <>
      {children}
      <LabNotifications />
    </>
  );
}
export function ClockControl() {
  const { clock } = useLabStore();
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border bg-card p-1 text-xs">
      <span className="px-2 font-semibold tabular-nums">Day {clock.day}</span>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={clock.playing ? pauseLab : playLab}
        aria-label={clock.playing ? "Pause clock" : "Play clock"}
      >
        {clock.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>
      {([1, 4, 16] as const).map((speed) => (
        <button
          key={speed}
          onClick={() => setLabSpeed(speed)}
          className={`rounded px-1.5 py-1 focus-visible:outline-2 focus-visible:outline-ring ${clock.speed === speed ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          {speed}×
        </button>
      ))}
      <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={skipToNextEvent}>
        <SkipForward className="h-3.5 w-3.5" />
        Skip to next look
      </Button>
    </div>
  );
}
