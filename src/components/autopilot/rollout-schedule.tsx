"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Check, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { RolloutPhase } from "@/lib/autopilot/rollout-plan";

interface DraftPhase {
  id: string;
  date: string;
  time: string;
  pass: string;
}

export function RolloutScheduleDialog({
  open,
  busy,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (phases: RolloutPhase[]) => Promise<void>;
}) {
  const [phases, setPhases] = useState<DraftPhase[]>(defaultPhases);
  const [error, setError] = useState("");

  const preview = useMemo(() => phases.map((phase) => ({ ...phase, at: combine(phase) })), [phases]);

  function update(id: string, patch: Partial<DraftPhase>) {
    setPhases((current) => current.map((phase) => (phase.id === id ? { ...phase, ...patch } : phase)));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    const payload = preview.map((phase) => ({ at: phase.at?.toISOString() ?? "", pass: Number(phase.pass) }));
    if (payload.some((phase) => !phase.at || Number.isNaN(new Date(phase.at).getTime()))) {
      setError("Each phase needs a date and a time.");
      return;
    }
    try {
      await onSave(payload);
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not schedule the rollout.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <form onSubmit={(event) => void save(event)}>
          <div className="border-b border-[#eef0f3] px-5 py-4">
            <h2 className="text-base font-medium text-[#111]">Scheduled automated rollout</h2>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-[88px_1.3fr_0.8fr_88px_32px] gap-2 px-1 text-xs text-[#6b7280]">
              <span>Phase</span>
              <span>Date</span>
              <span>Time</span>
              <span>Pass</span>
              <span />
            </div>
            <div className="mt-2 space-y-2">
              {phases.map((phase, index) => (
                <div key={phase.id} className="grid grid-cols-[88px_1.3fr_0.8fr_88px_32px] items-center gap-2">
                  <span className="flex items-center gap-1 text-sm font-medium">
                    {index === 0 ? "Current" : `Phase ${index}`}
                    {index === 0 && <Check className="h-3.5 w-3.5 text-[#17803d]" />}
                  </span>
                  <input type="date" required value={phase.date} onChange={(event) => update(phase.id, { date: event.target.value })} className="h-9 rounded-md border border-[#e6e8ec] px-2 text-sm" />
                  <input type="time" required value={phase.time} onChange={(event) => update(phase.id, { time: event.target.value })} className="h-9 rounded-md border border-[#e6e8ec] px-2 text-sm" />
                  <label className="flex h-9 items-center rounded-md border border-[#e6e8ec] px-2 text-sm">
                    <input
                      aria-label={index === 0 ? "Current pass percentage" : `Phase ${index} pass percentage`}
                      inputMode="numeric"
                      value={phase.pass}
                      onChange={(event) => update(phase.id, { pass: event.target.value.replace(/[^\d]/g, "").slice(0, 3) })}
                      className="w-full bg-transparent outline-none"
                    />
                    <span className="text-[#9aa0a8]">%</span>
                  </label>
                  {index === 0 ? <span /> : (
                    <button type="button" aria-label={`Remove phase ${index}`} onClick={() => setPhases((current) => current.filter((item) => item.id !== phase.id))} className="grid h-8 w-8 place-items-center rounded-full text-[#9aa0a8] hover:bg-[#f3f4f6] hover:text-[#111]">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 text-sm font-medium text-[#1d4e89] hover:underline disabled:opacity-40"
              disabled={phases.length >= 6}
              onClick={() => setPhases((current) => [...current, nextPhase(current)])}
            >
              + Add another phase
            </button>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </div>
          <div className="border-t border-[#eef0f3] px-5 py-4">
            <p className="text-sm font-medium">Preview</p>
            <p className="text-xs text-[#6b7280]">Updated state of the rollout after these changes</p>
            <div className="mt-4 rounded-lg bg-[#f7f8fa] px-4 py-5">
              <div className="relative flex justify-between">
                <div className="absolute left-4 right-4 top-3 h-px bg-[#d5d8de]" />
                {preview.map((phase, index) => (
                  <div key={phase.id} className="relative z-10 flex w-28 flex-col items-center text-center">
                    <span className={`grid h-6 w-6 place-items-center rounded-full ${index === 0 ? "bg-[#17803d] text-white" : "bg-[#d5d8de] text-white"}`}>
                      {index === 0 ? <Check className="h-3.5 w-3.5" /> : <span className="h-2.5 w-2.5 rounded-full bg-white" />}
                    </span>
                    <p className="mt-2 text-xs font-medium">{index === 0 ? "Current" : `Phase ${index}`}</p>
                    <p className="text-[11px] text-[#6b7280]">{phase.at ? formatWhen(phase.at) : "Set a time"}</p>
                    <span className="mt-1 rounded-full bg-[#d9f2e3] px-2 py-0.5 text-[11px] text-[#17663a]">Pass: {phase.pass || "0"}%</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 text-right text-xs text-[#17803d]">Current pass: {phases[0]?.pass || "0"}%</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#eef0f3] px-5 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" className="bg-[#111] text-white hover:bg-[#2a2a2a]" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function defaultPhases(): DraftPhase[] {
  const now = new Date();
  const soon = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const later = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  return [
    { id: "current", date: dateInput(now), time: timeInput(now), pass: "20" },
    { id: "phase-1", date: dateInput(soon), time: timeInput(soon), pass: "50" },
    { id: "phase-2", date: dateInput(later), time: timeInput(later), pass: "90" },
  ];
}

function nextPhase(phases: DraftPhase[]): DraftPhase {
  const last = phases[phases.length - 1];
  const from = combine(last) ?? new Date();
  const next = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { id: crypto.randomUUID(), date: dateInput(next), time: timeInput(next), pass: "100" };
}

function combine(phase: DraftPhase): Date | null {
  if (!phase.date || !phase.time) return null;
  const value = new Date(`${phase.date}T${phase.time}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function dateInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function timeInput(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatWhen(date: Date): string {
  return date.toLocaleString("en-US", { month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
