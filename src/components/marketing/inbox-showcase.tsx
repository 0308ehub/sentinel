"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AgentMark } from "@/components/inbox/agent-mark";
import { mockCandidates, type Candidate } from "@/lib/inbox/producers";
import { SEED_AGENTS, type SeedAgent } from "@/lib/inbox/roster";
import { judge, nextWeight, selectDelivery, type Tier } from "@/lib/inbox/score";

const COST = 0.05;

interface Ranked {
  id: string;
  candidate: Candidate;
  agent: SeedAgent;
  score: number;
  tier: Tier;
  explanation: string;
  sent: boolean;
}

interface LocalText {
  slug: string;
  mine: boolean;
  body: string;
}

function rank(weights: Record<string, number>): Ranked[] {
  const judged = mockCandidates().flatMap((candidate) => {
    const agent = SEED_AGENTS.find((item) => item.slug === candidate.agentSlug);
    if (!agent) return [];
    const decision = judge({
      id: candidate.semanticKey,
      evidence: candidate.confidence,
      impact: candidate.impact,
      urgency: candidate.urgency,
      relevance: weights[candidate.type] ?? 1,
      interruptionCost: COST,
      ignoredStreak: 0,
      muted: false,
      interruptsLeft: 3,
    });
    return [{ id: candidate.semanticKey, candidate, agent, score: decision.score, tier: decision.tier, explanation: decision.explanation, sent: false }];
  });
  const chosen = selectDelivery(judged, {
    mode: "session",
    withinHours: true,
    sessionStart: true,
    cap: 4,
    interruptsLeft: 3,
  });
  const chosenTier = new Map(chosen.map((item) => [item.id, item.tier]));
  return judged
    .map((row) => ({ ...row, sent: chosenTier.has(row.id), tier: chosenTier.get(row.id) ?? row.tier }))
    .sort((a, b) => b.score - a.score);
}

function confidenceLabel(value: number): string {
  if (value >= 0.75) return "Fairly sure";
  if (value >= 0.45) return "A reasonable guess";
  return "Just a hunch";
}

function place(row: Ranked, shown: string[]): string {
  if (row.tier === "LOG") return "Quiet";
  if (!row.sent) return "Next sitting";
  if (!shown.includes(row.id)) return "Scoring";
  return "Texted";
}

export function InboxShowcase({ compact = false }: { compact?: boolean }) {
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [shown, setShown] = useState<string[]>([]);
  const [typing, setTyping] = useState<string | null>(null);
  const [open, setOpen] = useState<string>("experiments");
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [texts, setTexts] = useState<LocalText[]>([]);
  const [clock, setClock] = useState("");
  const rows = useMemo(() => rank(weights), [weights]);

  useEffect(() => {
    setClock(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const initial = rank({});
    const sent = initial.filter((row) => row.sent);
    if (media.matches) {
      setShown(sent.map((row) => row.id));
      setOpen(sent.at(-1)?.agent.slug ?? "experiments");
      setReady(true);
      return;
    }
    const timers = sent.flatMap((row, index) => [
      window.setTimeout(() => setTyping(row.agent.slug), 400 + index * 1600),
      window.setTimeout(() => {
        setTyping(null);
        setShown((current) => (current.includes(row.id) ? current : [...current, row.id]));
        setOpen(row.agent.slug);
        if (index === sent.length - 1) setReady(true);
      }, 1000 + index * 1600),
    ]);
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const visible = new Set(shown);
  const threads = [...rows].sort((a, b) => Number(visible.has(b.id)) - Number(visible.has(a.id)) || b.score - a.score);
  const active = rows.find((row) => row.agent.slug === open) ?? rows[0];
  const activeShown = active ? visible.has(active.id) : false;
  const live = active ? texts.filter((text) => text.slug === active.agent.slug) : [];

  function dismiss(type: string) {
    if (!ready) return;
    const nextWeights = { ...weights, [type]: nextWeight(weights[type] ?? 1, "dismiss") };
    const nextRows = rank(nextWeights);
    const nextShown = nextRows.filter((row) => row.sent).map((row) => row.id);
    const entered = nextRows.find((row) => row.sent && !shown.includes(row.id));
    setWeights(nextWeights);
    setShown(nextShown);
    if (entered) setOpen(entered.agent.slug);
  }

  function send(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !active || !activeShown) return;
    const reply = active.candidate.proposedAction;
    setTexts((current) => [...current, { slug: active.agent.slug, mine: true, body }]);
    setDraft("");
    setTyping(active.agent.slug);
    window.setTimeout(() => {
      setTexts((current) => [...current, { slug: active.agent.slug, mine: false, body: reply }]);
      setTyping((current) => (current === active.agent.slug ? null : current));
    }, 700);
  }

  return (
    <div className={compact ? "" : "grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_280px]"}>
      <div className={`flex overflow-hidden rounded-2xl bg-white text-[#141414] shadow-[0_22px_60px_rgba(16,36,48,0.16)] ring-1 ring-black/10 ${compact ? "h-[440px]" : "h-[560px]"}`}>
        <aside className="flex w-[248px] shrink-0 flex-col border-r border-[#ececec] bg-[#f6f7f9] sm:w-[280px]">
          <div className="px-3 pb-2 pt-3 text-sm text-[#8b919a]">Search</div>
          <div className="flex gap-3 overflow-x-auto px-3 pb-2">
            {threads.filter((row) => visible.has(row.id)).slice(0, 3).map((row) => (
              <button key={row.id} type="button" onClick={() => setOpen(row.agent.slug)} className="flex w-14 shrink-0 flex-col items-center gap-1">
                <AgentMark name={row.agent.name} icon={row.agent.letter} color={row.agent.color} size={44} />
                <span className="w-full truncate text-center text-[10px]">{row.agent.name}</span>
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {threads.map((row) => {
              const arrived = visible.has(row.id);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setOpen(row.agent.slug)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left ${open === row.agent.slug ? "bg-white" : "hover:bg-white/70"}`}
                >
                  <AgentMark name={row.agent.name} icon={row.agent.letter} color={row.agent.color} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{row.agent.name}</span>
                      {arrived && <span className="shrink-0 text-[10px] text-[#8b919a]">{clock}</span>}
                    </span>
                    <span className="block truncate text-xs text-[#6b7280]">
                      {typing === row.agent.slug ? "···" : arrived ? row.candidate.intro || row.candidate.title : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col">
          {active && (
            <>
              <header className="flex items-center gap-2 border-b border-[#ececec] px-4 py-3">
                <AgentMark name={active.agent.name} icon={active.agent.letter} color={active.agent.color} size={32} />
                <h2 className="text-sm font-semibold">{active.agent.name}</h2>
              </header>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4" aria-live="polite">
                {!activeShown && typing !== active.agent.slug && (
                  <div className="flex h-full flex-col items-center justify-center gap-2">
                    <AgentMark name={active.agent.name} icon={active.agent.letter} color={active.agent.color} size={64} />
                    <p className="text-sm font-medium">{active.agent.name}</p>
                  </div>
                )}
                {activeShown && (
                  <>
                    <p className="py-1 text-center text-[11px] text-[#8b919a]">{active.candidate.activity}</p>
                    {active.candidate.intro && (
                      <p className="max-w-[78%] rounded-2xl rounded-bl-md bg-[#f4f5f7] px-3 py-2 text-sm leading-5">{active.candidate.intro}</p>
                    )}
                    <article className="w-full max-w-sm rounded-2xl border border-[#e6e6e6] p-3 text-sm">
                      <h3 className="font-medium">{active.candidate.title}</h3>
                      <p className="mt-2"><span className="block text-[11px] text-[#8b919a]">I noticed</span>{active.candidate.summary}</p>
                      <p className="mt-2"><span className="block text-[11px] text-[#8b919a]">I think</span>{active.candidate.hypothesis}</p>
                      <p className="mt-2"><span className="block text-[11px] text-[#8b919a]">I'd do</span>{active.candidate.proposedAction}</p>
                      <p className="mt-2 text-xs text-[#8b919a]">{confidenceLabel(active.candidate.confidence)}</p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        <span className="rounded-full border border-[#e6e6e6] px-2 py-1 text-[11px]">Approve</span>
                        <button type="button" onClick={() => dismiss(active.candidate.type)} className="rounded-full border border-[#e6e6e6] px-2 py-1 text-[11px] hover:bg-[#f4f5f7]">Not now</button>
                      </div>
                      <p className="mt-2 text-[11px] leading-4 text-[#8b919a]">{active.explanation}</p>
                    </article>
                  </>
                )}
                {live.map((text, index) => (
                  <p key={`${text.body}-${index}`} className={text.mine ? "ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-[#111] px-3 py-2 text-sm leading-5 text-white" : "max-w-[78%] rounded-2xl rounded-bl-md bg-[#f4f5f7] px-3 py-2 text-sm leading-5"}>
                    {text.body}
                  </p>
                ))}
                {typing === active?.agent.slug && <p className="w-fit rounded-2xl bg-[#f4f5f7] px-3 py-2 text-sm text-[#8b919a]">···</p>}
              </div>
              <form onSubmit={send} className="flex items-center gap-2 border-t border-[#ececec] px-3 py-3">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Message"
                  aria-label="Message"
                  className="h-9 min-w-0 flex-1 rounded-2xl border border-[#e6e6e6] px-3 text-sm outline-none"
                />
                <button type="submit" disabled={!draft.trim() || !activeShown} className="h-9 rounded-full bg-[#111] px-3 text-sm text-white disabled:opacity-40">
                  Send
                </button>
              </form>
            </>
          )}
        </section>
      </div>
      {!compact && (
      <aside className="flex flex-col rounded-2xl bg-white p-4 text-[#141414] shadow-[0_22px_60px_rgba(16,36,48,0.12)] ring-1 ring-black/10">
        <h2 className="text-sm font-semibold">This sitting</h2>
        <p className="mt-1 text-[11px] leading-4 text-[#6b7280]">evidence × impact × urgency × relevance − 0.05</p>
        <ol className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
          {rows.map((row) => {
            const status = place(row, shown);
            const width = `${Math.round(Math.max(0, Math.min(1, row.score)) * 100)}%`;
            return (
              <li key={row.id}>
                <div className="flex items-center gap-2">
                  <AgentMark name={row.agent.name} icon={row.agent.letter} color={row.agent.color} size={22} />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{row.agent.name}</span>
                  <span className="shrink-0 text-[10px] tabular-nums text-[#6b7280]">{row.score.toFixed(2)}</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#f4f5f7]">
                  <div className="h-full rounded-full" style={{ width, background: row.agent.color }} />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[#6b7280]">{status} · {row.tier === "LOG" ? "Log" : row.tier[0] + row.tier.slice(1).toLowerCase()}</span>
                  {status === "Texted" && (
                    <button type="button" onClick={() => dismiss(row.candidate.type)} className="text-[10px] text-[#111]">
                      Not now
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </aside>
      )}
    </div>
  );
}
