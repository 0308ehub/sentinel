"use client";

import { useEffect, useState } from "react";
import { SettingsShell } from "@/components/settings/settings-shell";
import type { InboxPrefs } from "@/lib/inbox/types";
import type { NotifyMode } from "@/lib/inbox/score";

const MODES: { id: NotifyMode; label: string }[] = [
  { id: "session", label: "When you sit down" },
  { id: "hours", label: "Through the workday" },
  { id: "always", label: "Any time" },
];

const LEVELS = ["NOTIFY_ONLY", "DRAFT", "ACT_WITHIN_GUARDRAILS"] as const;

export function InboxSettingsView() {
  const [prefs, setPrefs] = useState<InboxPrefs | null>(null);
  const [slack, setSlack] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/inbox/preferences")
      .then(async (res) => {
        const body = (await res.json()) as { prefs?: InboxPrefs; slackAvailable?: boolean; error?: string };
        if (!res.ok || !body.prefs) {
          setError(body.error || "Agents need a database.");
          return;
        }
        setPrefs(body.prefs);
        setSlack(Boolean(body.slackAvailable));
      })
      .catch(() => setError("Agents need a database."));
  }, []);

  async function save(next: InboxPrefs, extra?: { weights?: { type: string; autonomy: string }[]; muted?: { id: string; muted: boolean }[] }) {
    setPrefs(next);
    const res = await fetch("/api/inbox/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...next, ...extra }),
    });
    if (!res.ok) return;
    const body = (await res.json()) as { prefs: InboxPrefs };
    setPrefs(body.prefs);
  }

  if (!prefs) {
    return (
      <SettingsShell title="Agents">
        <p className="text-sm text-muted-foreground">{error}</p>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell title="Agents">
      <div className="space-y-8">
        <fieldset>
          <legend className="text-sm font-medium">When they can text</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => void save({ ...prefs, mode: mode.id })}
                className={`rounded-full border px-3 py-1 text-sm ${prefs.mode === mode.id ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-6">
          <label className="text-sm">
            From
            <input
              type="number"
              min={0}
              max={23}
              value={prefs.workStart}
              onChange={(event) => void save({ ...prefs, workStart: Number(event.target.value) })}
              className="ml-2 h-9 w-16 rounded-md border border-input px-2"
            />
          </label>
          <label className="text-sm">
            Until
            <input
              type="number"
              min={1}
              max={24}
              value={prefs.workEnd}
              onChange={(event) => void save({ ...prefs, workEnd: Number(event.target.value) })}
              className="ml-2 h-9 w-16 rounded-md border border-input px-2"
            />
          </label>
        </div>
        <div className="flex gap-6">
          <label className="text-sm">
            Quiet hours before a new sitting
            <input
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={prefs.idleHours}
              onChange={(event) => void save({ ...prefs, idleHours: Number(event.target.value) })}
              className="ml-2 h-9 w-16 rounded-md border border-input px-2"
            />
          </label>
          <label className="text-sm">
            Texts at the start
            <input
              type="number"
              min={3}
              max={5}
              value={prefs.sessionCap}
              onChange={(event) => void save({ ...prefs, sessionCap: Number(event.target.value) })}
              className="ml-2 h-9 w-16 rounded-md border border-input px-2"
            />
          </label>
          <label className="text-sm">
            Urgent texts a day
            <input
              type="number"
              min={0}
              max={20}
              value={prefs.dailyInterruptBudget}
              onChange={(event) => void save({ ...prefs, dailyInterruptBudget: Number(event.target.value) })}
              className="ml-2 h-9 w-16 rounded-md border border-input px-2"
            />
          </label>
        </div>
        <div>
          <h2 className="text-sm font-medium">Mute</h2>
          <div className="mt-2 divide-y divide-border">
            {prefs.agents.map((agent) => (
              <label key={agent.id} className="flex items-center justify-between py-2 text-sm">
                {agent.name}
                <input
                  type="checkbox"
                  checked={agent.muted}
                  onChange={(event) => {
                    const muted = event.target.checked;
                    void save(
                      { ...prefs, agents: prefs.agents.map((item) => (item.id === agent.id ? { ...item, muted } : item)) },
                      { muted: [{ id: agent.id, muted }] },
                    );
                  }}
                />
              </label>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-medium">What they&apos;ve learned</h2>
          <div className="mt-2 space-y-2">
            {prefs.weights.map((weight) => (
              <div key={weight.type} className="flex items-center justify-between gap-3 text-sm">
                <span className="capitalize">{weight.type}</span>
                <span className="tabular-nums text-muted-foreground">{weight.weight.toFixed(2)}</span>
                <select
                  value={weight.autonomy}
                  onChange={(event) =>
                    void save(prefs, { weights: prefs.weights.map((item) => (item.type === weight.type ? { type: item.type, autonomy: event.target.value } : { type: item.type, autonomy: item.autonomy })) })
                  }
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>{level === "NOTIFY_ONLY" ? "Tell me" : level === "DRAFT" ? "Draft" : "Act in guardrails"}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
        {slack && (
          <div className="space-y-2">
            <label className="flex items-center justify-between text-sm">
              Urgent texts also go to Slack
              <input
                type="checkbox"
                checked={prefs.slackInterrupts}
                onChange={(event) => void save({ ...prefs, slackInterrupts: event.target.checked })}
              />
            </label>
            <input
              value={prefs.slackChannel}
              onChange={(event) => setPrefs({ ...prefs, slackChannel: event.target.value })}
              onBlur={() => void save(prefs)}
              placeholder="Channel id"
              className="h-9 w-full rounded-md border border-input px-2 text-sm"
            />
          </div>
        )}
      </div>
    </SettingsShell>
  );
}
