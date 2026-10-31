"use client";

import { PANTRY } from "@/lib/lab/company";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AGENT_LABELS } from "@/components/lab/labels";
import type { LabExperiment } from "@/lib/lab/advance";
import { runDiscovery, useLabStore, type LabState } from "@/lib/lab/store";
import type { Update } from "@/lib/lab/types";
import { cn } from "@/lib/utils";

export type LoopAgentId = keyof typeof AGENT_LABELS;
type LoopStatus = "Working" | "Waiting on you" | "Idle";
type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

const AGENT_ORDER = Object.keys(AGENT_LABELS) as LoopAgentId[];
const ROLES: Record<LoopAgentId, string> = {
  scout: "Reads company context and experiment results, then writes evidence-backed proposals.",
  designer: "Turns proposals into statistically sound experiment plans.",
  analyst: "Watches running experiments, checks guardrails, and explains every look.",
  shipper: "Writes readouts and the winning code change, then waits for human approval.",
};

interface AgentView {
  id: LoopAgentId;
  status: LoopStatus;
  activity: string;
  count: number;
  countLabel: string;
  updates: Update[];
  experiment: LabExperiment | null;
}

export function parseLoopAgentId(value: string | null): LoopAgentId | null {
  if (!value?.startsWith("loop-")) return null;
  const id = value.slice(5) as LoopAgentId;
  return AGENT_ORDER.includes(id) ? id : null;
}

export function LoopAgents({ onOpen }: { onOpen: (id: LoopAgentId) => void }) {
  const state = useLabStore();
  const agents = useMemo(() => buildAgentViews(state), [state]);
  const handoff = latestHandoff(state);

  return (
    <section aria-labelledby="experiment-loop-heading">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="experiment-loop-heading"
            className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground"
          >
            Experiment loop
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Four specialists carry each test from evidence to a reviewed change.
          </p>
        </div>
        <Link href="/experiments" className="text-xs font-medium text-primary hover:underline">
          Open experiments <ArrowRight className="ml-1 inline h-3 w-3" />
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {agents.map((agent) => (
          <article key={agent.id} className="flex min-w-0 flex-col rounded-md border bg-card p-4">
            <button type="button" onClick={() => onOpen(agent.id)} className="text-left">
              <div className="flex items-center gap-2">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: AGENT_LABELS[agent.id].color }}
                >
                  {AGENT_LABELS[agent.id].initials}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{AGENT_LABELS[agent.id].name}</h3>
                  <p className="text-[11px] text-muted-foreground">{ROLES[agent.id]}</p>
                </div>
                <Status status={agent.status} />
              </div>
              <p className="mt-3 min-h-10 text-sm leading-snug">{agent.activity}</p>
            </button>

            <div className="mt-3 border-t pt-3">
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Latest updates</span>
                <b className="font-medium text-foreground">
                  {agent.count} {agent.countLabel}
                </b>
              </div>
              <div className="space-y-2">
                {agent.updates.length ? (
                  agent.updates.slice(0, 3).map((update) => (
                    <div key={update.id} className="text-xs leading-snug">
                      <span className="mr-1.5 tabular-nums text-muted-foreground">Day {update.day}</span>
                      <span>{update.title}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No updates yet.</p>
                )}
              </div>
            </div>

            <div className="mt-auto pt-4">
              {agent.id === "scout" && state.discovery.status === "idle" ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={runDiscovery}>
                    Run discovery
                  </Button>
                  <Link href="/experiments" className="text-xs text-primary hover:underline">
                    View loop
                  </Link>
                </div>
              ) : (
                <Link
                  href={agent.experiment ? `/experiments/${agent.experiment.id}` : "/experiments"}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {agent.experiment ? agent.experiment.proposal.title : "View experiment loop"}
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>

      <HandoffLine handoff={handoff} />
    </section>
  );
}

export function LoopAgentRoom({ id, onClose }: { id: LoopAgentId; onClose: () => void }) {
  const state = useLabStore();
  const agent = buildAgentViews(state).find((item) => item.id === id)!;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send(event: FormEvent) {
    event.preventDefault();
    const question = text.trim();
    if (!question || sending) return;
    const user: ChatMessage = { id: crypto.randomUUID(), role: "user", content: question };
    const history = [...messages, user];
    setMessages(history);
    setText("");
    setSending(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Act as ${AGENT_LABELS[id].name}. ${ROLES[id]} Answer in under 120 words, in plain text with no markdown. Use only the numbers in this lab state and say when something is not in it:\n${summaryFor(id, state)}`,
            },
            ...history.slice(-10).map((message) => ({ role: message.role, content: message.content })),
          ],
        }),
      });
      const body = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !body.reply) throw new Error(body.error || "The model request failed.");
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: body.reply! }]);
    } catch {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: fallbackAnswer(id, state) },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="absolute inset-0 z-10 flex origin-center animate-[agent-zoom_220ms_ease-out] flex-col bg-background motion-reduce:animate-none">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" /> All agents
        </button>
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: AGENT_LABELS[id].color }} />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{AGENT_LABELS[id].name}</h2>
          <p className="truncate text-xs text-muted-foreground">{ROLES[id]}</p>
        </div>
        <Status status={agent.status} />
      </header>

      <div className="flex-1 overflow-auto px-4 py-5">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
              Full update history
            </h3>
            <div className="divide-y rounded-md border bg-card">
              {agent.updates.length ? (
                agent.updates.map((update) => (
                  <div key={update.id} className="p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <b>{update.title}</b>
                      <span className="text-muted-foreground">Day {update.day}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{update.body}</p>
                  </div>
                ))
              ) : (
                <p className="p-8 text-center text-sm text-muted-foreground">No updates yet.</p>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
              Ask {AGENT_LABELS[id].name}
            </h3>
            <div className="space-y-3">
              <p className="rounded-md border bg-card p-3 text-sm text-muted-foreground">{agent.activity}</p>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    message.role === "user" ? "ml-8 bg-foreground text-background" : "mr-8 bg-muted",
                  )}
                >
                  {message.content}
                </div>
              ))}
              {sending && <p className="text-xs text-muted-foreground">Thinking from the experiment record…</p>}
            </div>
          </section>
        </div>
      </div>

      <form onSubmit={send} className="flex gap-2 border-t p-3 pr-16">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={`Ask ${AGENT_LABELS[id].name} about the experiment loop`}
          className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <Button type="submit" disabled={!text.trim() || sending}>
          <Send className="mr-1 h-3.5 w-3.5" /> Send
        </Button>
      </form>
    </div>
  );
}

function buildAgentViews(state: LabState): AgentView[] {
  const latestFor = (id: LoopAgentId) => state.feed.filter((update) => update.agent === id);
  const proposed = state.experiments.filter((experiment) => !experiment.proposal.skippedReason);
  const planned = state.experiments.filter((experiment) => experiment.design);
  const running = state.experiments.filter((experiment) => experiment.stage === "running");
  const waitingPlans = planned.filter((experiment) => experiment.stage === "designed");
  const shipping = state.experiments.filter((experiment) => experiment.stage === "shipping");
  const waitingShip = shipping.filter((experiment) => experiment.ship?.status === "awaiting");
  const nextLook = running
    .map((experiment) => {
      const elapsed = state.clock.day - (experiment.launchedDay ?? state.clock.day) + 1;
      const look = experiment.design?.lookDays.find((day) => day > elapsed);
      return look ? { experiment, day: (experiment.launchedDay ?? state.clock.day) + look - 1 } : null;
    })
    .filter((item): item is { experiment: LabExperiment; day: number } => Boolean(item))
    .sort((a, b) => a.day - b.day)[0];
  const latestReadout = state.experiments.filter((experiment) => experiment.readout).at(-1) ?? null;

  return [
    {
      id: "scout",
      status: state.discovery.status === "reading" ? "Working" : "Idle",
      activity:
        state.discovery.status === "reading"
          ? `Reading Pantry context (${Math.min(state.discovery.step + 1, 6)} of 6 sources).`
          : proposed.length
            ? `Watching results for the next idea after proposing ${proposed.length} tests.`
            : "Ready to read Pantry’s goals, users, and code.",
      count: proposed.length,
      countLabel: proposed.length === 1 ? "proposal" : "proposals",
      updates: latestFor("scout"),
      experiment: proposed.at(-1) ?? null,
    },
    {
      id: "designer",
      status: waitingPlans.length
        ? "Waiting on you"
        : state.experiments.some((item) => item.stage === "designed" && !item.design)
          ? "Working"
          : "Idle",
      activity: waitingPlans.length
        ? `Waiting for you to launch ${waitingPlans.length} ${waitingPlans.length === 1 ? "plan" : "plans"}.`
        : planned.length
          ? `Finished ${planned.length} experiment ${planned.length === 1 ? "plan" : "plans"}.`
          : "Waiting for Scout’s first proposal to design.",
      count: planned.length,
      countLabel: planned.length === 1 ? "plan" : "plans",
      updates: latestFor("designer"),
      experiment: waitingPlans[0] ?? planned.at(-1) ?? proposed[0] ?? null,
    },
    {
      id: "analyst",
      status: running.length ? "Working" : "Idle",
      activity: running.length
        ? `Watching ${running.length} ${running.length === 1 ? "experiment" : "experiments"}.${nextLook ? ` Next look for “${nextLook.experiment.proposal.title}” on day ${nextLook.day}.` : ""}`
        : "Waiting for an experiment to go live.",
      count: latestFor("analyst").filter((update) => update.id.includes("-look-")).length,
      countLabel: "looks",
      updates: latestFor("analyst"),
      experiment: running[0] ?? latestReadout,
    },
    {
      id: "shipper",
      status: waitingShip.length ? "Waiting on you" : "Idle",
      activity: waitingShip.length
        ? `Waiting for your approval on ${waitingShip.length} ${waitingShip.length === 1 ? "code change" : "code changes"}.`
        : latestReadout
          ? `Filed the readout for “${latestReadout.proposal.title}.”`
          : "Waiting for Analyst’s first result.",
      count: state.experiments.filter((experiment) => experiment.ship).length,
      countLabel: "PRs",
      updates: latestFor("shipper"),
      experiment: waitingShip[0] ?? latestReadout,
    },
  ];
}

function latestHandoff(state: LabState) {
  const update = state.feed[0];
  if (!update) return null;
  const from = update.agent;
  const to = AGENT_ORDER[(AGENT_ORDER.indexOf(from) + 1) % AGENT_ORDER.length];
  const experiment = state.experiments.find((item) => item.updates.some((itemUpdate) => itemUpdate.id === update.id));
  return { from, to, day: update.day, title: experiment?.proposal.title ?? update.title };
}

function HandoffLine({ handoff }: { handoff: ReturnType<typeof latestHandoff> }) {
  const cycle = [...AGENT_ORDER, "scout"] as LoopAgentId[];
  return (
    <div className="mt-3 rounded-md border bg-card px-3 py-3 sm:px-4" aria-label="Latest agent handoff">
      <div className="relative mx-auto flex max-w-4xl items-center justify-between">
        <span className="absolute left-5 right-5 top-2 h-px bg-border" />
        {cycle.map((id, index) => (
          <div
            key={`${id}-${index}`}
            className="relative z-[1] flex min-w-0 flex-1 flex-col items-center gap-1 bg-card px-0.5 sm:px-2"
          >
            <span
              className={cn(
                "h-4 w-4 rounded-full border-2 border-card",
                handoff?.from === id && index < AGENT_ORDER.length && "ring-2 ring-foreground/20 ring-offset-1",
              )}
              style={{ backgroundColor: AGENT_LABELS[id].color }}
            />
            <span className="truncate text-[9px] text-muted-foreground sm:text-[10px]">{AGENT_LABELS[id].name}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {handoff
          ? `${AGENT_LABELS[handoff.from].name} handed “${handoff.title}” to ${AGENT_LABELS[handoff.to].name} on day ${handoff.day}.`
          : "The next handoff starts when Scout finishes discovery."}
      </p>
    </div>
  );
}

function Status({ status }: { status: LoopStatus }) {
  return (
    <span
      className={cn(
        "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "Working" && "bg-sky-100 text-sky-800",
        status === "Waiting on you" && "bg-amber-100 text-amber-800",
        status === "Idle" && "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

const pct = (value: number) => `${value >= 0 ? "+" : "-"}${Math.abs(value * 100).toFixed(1)}%`;

/** One short paragraph per experiment with the numbers an agent needs, small enough for the chat context. */
function summaryFor(id: LoopAgentId, state: LabState): string {
  const lines = state.experiments.map((experiment) => {
    const parts = [`"${experiment.proposal.title}" (${experiment.proposal.objective}): ${experiment.stage}`];
    const design = experiment.design;
    if (design) {
      const guardrails = design.guardrails
        .map(
          (g) =>
            `${PANTRY.metrics[g.metric].label} may not drop more than ${(g.margin * 100).toFixed(1)}% (${g.action === "stop" ? "stops the test" : "blocks ship"})`,
        )
        .join("; ");
      parts.push(
        `primary ${PANTRY.metrics[design.primaryMetric].label}, MDE ${pct(design.mde)}, ${design.durationDays} days planned at ${(design.allocation * 100).toFixed(0)}% traffic, looks on days ${design.lookDays.join(", ")} needing z ${design.boundaries.map((b) => b.efficacyZ.toFixed(2)).join("/")}. Guardrails: ${guardrails}`,
      );
    }
    if (experiment.launchedDay !== null) parts.push(`launched clock day ${experiment.launchedDay}`);
    const look = experiment.run?.looks
      .filter((item) => experiment.updates.some((u) => u.id.endsWith(`-look-${item.look}`)))
      .at(-1);
    if (look) {
      const guardrails = look.guardrails
        .map((g) => `${PANTRY.metrics[g.metric].label} ${pct(g.lift)} [${pct(g.ciLow)}, ${pct(g.ciHigh)}] ${g.status}`)
        .join(", ");
      const segments = look.segments
        .map((seg) => `${seg.segment} ${pct(seg.lift)} [${pct(seg.ciLow)}, ${pct(seg.ciHigh)}]`)
        .join(", ");
      parts.push(
        `latest look ${look.look} on experiment day ${look.day}: lift ${pct(look.lift)} [${pct(look.ciLow)}, ${pct(look.ciHigh)}], z ${look.z.toFixed(2)} vs ${look.boundaryZ.toFixed(2)}; guardrails ${guardrails}; segments ${segments}`,
      );
    }
    if (experiment.readout)
      parts.push(`decision: ${experiment.readout.headline}. Next idea: ${experiment.readout.nextIdea}`);
    if (id === "shipper" && experiment.ship)
      parts.push(`ship review ${experiment.ship.status}: ${experiment.ship.diff.title}`);
    return `- ${parts.join(". ")}.`;
  });
  return [`Clock day ${state.clock.day}. Company: ${PANTRY.name}, ${PANTRY.pitch}`, ...lines].join("\n").slice(0, 6500);
}

function fallbackAnswer(id: LoopAgentId, state: LabState): string {
  const readouts = state.experiments.filter((experiment) => experiment.readout);
  if (readouts.length) {
    const experiment = readouts.at(-1)!;
    return `${experiment.readout!.headline} ${experiment.readout!.summary.join(" ")}`;
  }
  const update = state.feed.find((item) => item.agent === id);
  return update ? `${update.title}: ${update.body}` : `${AGENT_LABELS[id].name} has no experiment update yet.`;
}
