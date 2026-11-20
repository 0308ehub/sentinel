"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Goal } from "@/lib/autopilot/types";

async function loadGoals(): Promise<Goal[]> {
  const response = await fetch("/api/autopilot/goals", { cache: "no-store" });
  const body = (await response.json()) as { goals?: Goal[]; error?: string };
  if (!response.ok) throw new Error(body.error ?? "Kismet could not load goals.");
  return body.goals ?? [];
}

export function GoalEditor({ onChanged }: { onChanged: () => void | Promise<unknown> }) {
  const goalsQuery = useQuery({ queryKey: ["autopilot-goals"], queryFn: loadGoals });
  const [goalName, setGoalName] = useState("");
  const [goalKind, setGoalKind] = useState<"click" | "visit" | "event">("click");
  const [goalValue, setGoalValue] = useState("");
  const [saving, setSaving] = useState(false);
  const goals = goalsQuery.data ?? [];

  async function refresh() {
    await goalsQuery.refetch();
    await onChanged();
  }

  async function addGoal() {
    const metric = goalKind === "click"
      ? { kind: "click", text: goalValue }
      : goalKind === "event"
        ? { kind: "event", name: goalValue.trim() }
        : { kind: "visit", path: goalValue };
    setSaving(true);
    try {
      const response = await fetch("/api/autopilot/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: goalName, metric }),
      });
      if (!response.ok) return;
      setGoalName("");
      setGoalValue("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function removeGoal(id: string) {
    setSaving(true);
    try {
      const response = await fetch("/api/autopilot/goals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (response.ok) await refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 max-w-2xl rounded-lg border border-[#e6e8ec] p-3 text-xs">
      {goalsQuery.isPending ? <p className="text-[#6b7280]">Loading goals…</p> : null}
      {goalsQuery.error ? <p className="text-red-700">{goalsQuery.error.message}</p> : null}
      {goals.map((goal) => (
        <div key={goal.id} className="flex items-center justify-between py-1">
          <span>{goal.name}</span>
          <button type="button" aria-label={`Remove ${goal.name}`} disabled={saving} className="text-[#6b7280] hover:text-red-600 disabled:opacity-50" onClick={() => void removeGoal(goal.id)}>Remove</button>
        </div>
      ))}
      <div className="mt-2 flex flex-wrap gap-2">
        <input aria-label="Goal name" value={goalName} onChange={(event) => setGoalName(event.target.value)} maxLength={60} placeholder="Goal name" className="h-8 rounded border px-2" />
        <select aria-label="Goal metric kind" value={goalKind} onChange={(event) => setGoalKind(event.target.value as "click" | "visit" | "event")} className="h-8 rounded border px-2"><option value="click">Click</option><option value="visit">Visit</option><option value="event">Event</option></select>
        <input aria-label={goalKind === "click" ? "Click label" : goalKind === "event" ? "Event name" : "Visit path"} value={goalValue} onChange={(event) => setGoalValue(event.target.value)} placeholder={goalKind === "click" ? "Button label" : goalKind === "event" ? "purchase" : "/path"} className="h-8 rounded border px-2" />
        <button type="button" disabled={saving || !goalName.trim() || !goalValue.trim() || goals.length >= 5} className="h-8 rounded border px-3 disabled:opacity-50" onClick={() => void addGoal()}>Add</button>
      </div>
    </div>
  );
}
