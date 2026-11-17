"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Circle, X } from "lucide-react";

const DISMISSED_KEY = "kismet-getting-started-dismissed";

interface ChecklistStatus {
  github: boolean;
  repo: boolean;
  evidence: boolean;
  autopilot: boolean;
}

const ITEMS = [
  { key: "github", label: "Connect GitHub", href: "/settings/connectors/github" },
  { key: "repo", label: "Choose the repository experiments ship to", href: "/settings/connectors/github" },
  { key: "evidence", label: "Connect Slack or Jira, or tell Kismet what customers say", href: "/settings/connectors" },
  { key: "autopilot", label: "Run your first experiment loop", href: "/experiments" },
] as const;

export function GettingStarted() {
  const [status, setStatus] = useState<ChecklistStatus | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadChecklist().then((result) => {
      if (cancelled || result.dismissed) return;
      setDismissed(false);
      setStatus(result.status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // Dismiss for this render even if persistence is unavailable.
    }
    setDismissed(true);
  }

  if (dismissed || !status) return null;
  const count = ITEMS.filter((item) => status[item.key]).length;
  if (count === ITEMS.length) return null;

  return (
    <section className="mb-6 w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm" aria-labelledby="getting-started-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="getting-started-title" className="text-sm font-medium">Get Kismet running</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{count} of {ITEMS.length}</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss getting started checklist" className="rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2">
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-3 space-y-1">
        {ITEMS.map((item) => {
          const done = status[item.key];
          return (
            <li key={item.key}>
              <Link href={item.href} className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted focus-visible:outline focus-visible:outline-2">
                {done ? <Check className="h-4 w-4 text-[#0571d3]" aria-hidden /> : <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />}
                <span className={done ? "text-muted-foreground line-through" : "text-foreground"}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

async function loadChecklist() {
  try {
    if (localStorage.getItem(DISMISSED_KEY) === "true") {
      return { dismissed: true, status: null };
    }
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
  return { dismissed: false, status: await loadStatus() };
}

async function loadStatus(): Promise<ChecklistStatus> {
  const [github, repo, slack, jira, autopilot] = await Promise.all([
    getJson<{ connected?: boolean }>("/api/github/status"),
    getJson<{ repo?: string }>("/api/autopilot/repo"),
    getJson<{ connected?: boolean }>("/api/slack/status"),
    getJson<{ connected?: boolean }>("/api/jira/status"),
    getJson<{ lastRunAt?: string | null; summary?: { realThisWeek?: number } }>("/api/autopilot"),
  ]);
  return {
    github: Boolean(github?.connected),
    repo: Boolean(repo?.repo),
    evidence: Boolean(slack?.connected || jira?.connected || (autopilot?.summary?.realThisWeek ?? 0) > 0),
    autopilot: Boolean(autopilot?.lastRunAt),
  };
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}
