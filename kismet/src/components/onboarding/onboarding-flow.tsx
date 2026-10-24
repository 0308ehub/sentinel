"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { ConnectorCatalog } from "@/components/connectors/connector-catalog";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import {
  COMPANY_SIZES,
  GOALS,
  ROLES,
  isOnboardingStep,
  readOnboarding,
  writeOnboarding,
  type OnboardingDraft,
  type OnboardingStep,
} from "@/lib/onboarding";
import type { JiraStatus } from "@/lib/jira/types";
import type { SlackStatus } from "@/lib/slack/types";
import { cn } from "@/lib/utils";

const TOUR = [
  {
    title: "Ask in the chat",
    body: "The front door is a conversation. Ask what people are saying, what to build next, or what a decision should be. When Slack is connected, the answer uses those messages and names the channel.",
  },
  {
    title: "The workspace holds the picture",
    body: "Explorer, Features, Timeline, and Graph are where Kismet files what it organizes. A feature, a problem, and a Slack thread can sit on the same product.",
  },
  {
    title: "Decisions stay attached to evidence",
    body: "Decisions, Analytics, and Settings are the rest of the workspace. Settings holds the connector list, and each tool files what it produces onto the product graph.",
  },
];

export function OnboardingFlow({ step }: { step: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [tourIndex, setTourIndex] = useState(0);

  useEffect(() => {
    const saved = readOnboarding();
    if (!isOnboardingStep(step)) {
      router.replace(`/onboarding/${saved.step}`);
      return;
    }
    setDraft(saved);
  }, [router, step]);

  if (!draft || !isOnboardingStep(step)) {
    return <div className="min-h-screen bg-white" />;
  }

  function save(patch: Partial<OnboardingDraft>) {
    const next = writeOnboarding(patch);
    setDraft(next);
    return next;
  }

  function go(next: OnboardingStep, patch?: Partial<OnboardingDraft>) {
    save({ ...patch, step: next });
    router.push(`/onboarding/${next}`);
  }

  if (step === "you") {
    return (
      <OnboardingShell
        step="you"
        title="What should we call you?"
        description="Kismet uses this on your workspace and when it files something you added."
        nextDisabled={!draft.name.trim() || !draft.role}
        onNext={() => go("company", { name: draft.name.trim(), role: draft.role })}
      >
        <Field label="Name">
          <input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className={inputClass}
            autoFocus
          />
        </Field>
        <Field label="Role" className="mt-6">
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((role) => (
              <Choice
                key={role}
                selected={draft.role === role}
                onClick={() => setDraft({ ...draft, role })}
                label={role}
              />
            ))}
          </div>
        </Field>
      </OnboardingShell>
    );
  }

  if (step === "company") {
    return (
      <OnboardingShell
        step="company"
        title="Tell us about the company"
        description="This is the product workspace Kismet will organize."
        onBack={() => go("you")}
        nextDisabled={!draft.company.trim() || !draft.size}
        onNext={() => go("goals", { company: draft.company.trim(), website: draft.website.trim(), size: draft.size })}
      >
        <Field label="Company">
          <input
            value={draft.company}
            onChange={(event) => setDraft({ ...draft, company: event.target.value })}
            placeholder="Company name"
            className={inputClass}
            autoFocus
          />
        </Field>
        <Field label="Website" className="mt-5">
          <input
            value={draft.website}
            onChange={(event) => setDraft({ ...draft, website: event.target.value })}
            placeholder="company.com"
            className={inputClass}
          />
        </Field>
        <Field label="Team size" className="mt-5">
          <div className="flex flex-wrap gap-2">
            {COMPANY_SIZES.map((size) => (
              <Choice
                key={size}
                selected={draft.size === size}
                onClick={() => setDraft({ ...draft, size })}
                label={size}
                className="w-auto"
              />
            ))}
          </div>
        </Field>
      </OnboardingShell>
    );
  }

  if (step === "goals") {
    return (
      <OnboardingShell
        step="goals"
        title="What do you want Kismet to help with?"
        description="Pick everything that fits. This steers what gets filed first."
        onBack={() => go("company")}
        nextDisabled={draft.goals.length === 0}
        onNext={() => go("connect", { goals: draft.goals })}
      >
        <div className="space-y-2">
          {GOALS.map((goal) => {
            const selected = draft.goals.includes(goal.id);
            return (
              <Choice
                key={goal.id}
                selected={selected}
                label={goal.label}
                onClick={() => {
                  setDraft((current) => {
                    if (!current) return current;
                    const goals = current.goals.includes(goal.id)
                      ? current.goals.filter((id) => id !== goal.id)
                      : [...current.goals, goal.id];
                    return { ...current, goals };
                  });
                }}
              />
            );
          })}
        </div>
      </OnboardingShell>
    );
  }

  if (step === "connect") {
    return (
      <ConnectStep onBack={() => go("goals")} onNext={() => go("organize")} />
    );
  }

  if (step === "organize") {
    return <OrganizeStep draft={draft} onBack={() => go("connect")} onNext={() => go("tour")} />;
  }

  const slide = TOUR[tourIndex];
  const last = tourIndex === TOUR.length - 1;
  return (
    <OnboardingShell
      step="tour"
      title={slide.title}
      description={slide.body}
      onBack={() => {
        if (tourIndex === 0) go("organize");
        else setTourIndex((n) => n - 1);
      }}
      nextLabel={last ? "Open Kismet" : "Next"}
      onNext={() => {
        if (!last) {
          setTourIndex((n) => n + 1);
          return;
        }
        writeOnboarding({ completed: true, step: "tour" });
        router.push("/ai");
      }}
    >
      <div className="flex gap-2">
        {TOUR.map((item, index) => (
          <span
            key={item.title}
            className={cn("h-1.5 w-8 rounded-full", index === tourIndex ? "bg-[#111]" : "bg-[#e6e8ec]")}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}

function ConnectStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [ready, setReady] = useState(false);

  return (
    <OnboardingShell
      step="connect"
      wide
      title="Connect your tools"
      description="Pick the systems the company already uses. Each one asks for the URL or key it needs. Kismet files what that source produces onto the product graph."
      onBack={onBack}
      onNext={onNext}
      nextLabel={ready ? "Continue" : "Skip for now"}
    >
      <ConnectorCatalog onConnectionsChange={setReady} />
    </OnboardingShell>
  );
}

function OrganizeStep({
  draft,
  onBack,
  onNext,
}: {
  draft: OnboardingDraft;
  onBack: () => void;
  onNext: () => void;
}) {
  const [lines, setLines] = useState<{ id: string; label: string; state: "wait" | "run" | "done" }[]>([
    { id: "profile", label: "Saving your profile", state: "wait" },
    { id: "company", label: "Saving the company", state: "wait" },
    { id: "goals", label: "Noting what you want to accomplish", state: "wait" },
    { id: "slack", label: "Checking Slack", state: "wait" },
    { id: "jira", label: "Checking Jira", state: "wait" },
    { id: "ready", label: "Preparing the workspace", state: "wait" },
  ]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const mark = (id: string, label: string, state: "run" | "done") => {
      if (cancelled) return;
      setLines((current) => current.map((line) => (line.id === id ? { ...line, label, state } : line)));
    };

    async function run() {
      mark("profile", `Saved ${draft.name || "your profile"}`, "run");
      await wait(450);
      mark("profile", `Saved ${draft.name || "your profile"}`, "done");
      mark("company", draft.company ? `Saved ${draft.company}` : "Saving the company", "run");
      await wait(450);
      mark("company", draft.company ? `Saved ${draft.company}` : "Saved the company", "done");
      mark("goals", "Noting what you want to accomplish", "run");
      await wait(400);
      mark("goals", `${draft.goals.length} goal${draft.goals.length === 1 ? "" : "s"} saved`, "done");
      mark("slack", "Checking Slack", "run");
      try {
        const statusRes = await fetch("/api/slack/status");
        const status = (await statusRes.json()) as SlackStatus;
        if (status.connected) {
          const channelsRes = await fetch("/api/slack/channels");
          const body = (await channelsRes.json()) as { channels?: { name: string }[]; error?: string };
          const names = (body.channels ?? []).slice(0, 4).map((channel) => `#${channel.name}`);
          mark(
            "slack",
            names.length
              ? `Slack · ${status.team ?? "workspace"} · ${names.join("  ")}`
              : `Slack connected${status.team ? ` · ${status.team}` : ""}. Invite the bot to a channel to read it.`,
            "done"
          );
        } else {
          mark("slack", "Slack is not connected yet. You can add it in Settings.", "done");
        }
      } catch {
        mark("slack", "Slack could not be reached. You can try again in Settings.", "done");
      }
      mark("jira", "Checking Jira", "run");
      try {
        const jiraRes = await fetch("/api/jira/status");
        const jira = (await jiraRes.json()) as JiraStatus;
        mark(
          "jira",
          jira.connected
            ? `Jira connected${jira.siteName ? ` · ${jira.siteName}` : ""}`
            : "Jira is not connected yet. You can add it in Settings.",
          "done"
        );
      } catch {
        mark("jira", "Jira could not be reached. You can try again in Settings.", "done");
      }
      mark("ready", "Workspace is ready", "run");
      await wait(500);
      mark("ready", "Workspace is ready", "done");
      if (!cancelled) setFinished(true);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [draft.company, draft.goals.length, draft.name]);

  return (
    <OnboardingShell
      step="organize"
      title="Setting up your workspace"
      description="Kismet is saving what you told us and reading Slack."
      onBack={finished ? onBack : undefined}
      onNext={finished ? onNext : undefined}
      nextLabel="See how Kismet works"
      nextDisabled={!finished}
      hideFooter={!finished}
    >
      <ul className="space-y-3">
        {lines.map((line) => (
          <li key={line.id} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
              {line.state === "done" ? (
                <Check className="h-4 w-4 text-[#0571d3]" />
              ) : line.state === "run" ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#5c6570]" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-[#d5d8de]" />
              )}
            </span>
            <span className={line.state === "wait" ? "text-[#8b939e]" : "text-[#111]"}>{line.label}</span>
          </li>
        ))}
      </ul>
    </OnboardingShell>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-2 block text-sm text-[#5c6570]">{label}</span>
      {children}
    </label>
  );
}

function Choice({
  label,
  selected,
  onClick,
  className,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors",
        selected ? "border-[#111] bg-[#f7f8fa]" : "border-[#e6e8ec] hover:bg-[#fafbfc]",
        className
      )}
    >
      <span>{label}</span>
      {selected && <Check className="h-4 w-4" />}
    </button>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-[#e6e8ec] px-3 text-sm outline-none focus:border-[#111]";
