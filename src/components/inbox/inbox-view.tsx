"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Pencil, SquareArrowOutUpRight } from "lucide-react";
import { ContactSheet } from "@/components/inbox/contact-sheet";
import { AgentMark } from "@/components/inbox/agent-mark";
import { PinStrip } from "@/components/inbox/pin-strip";
import { ThreadFaces } from "@/components/inbox/thread-faces";
import { ThreadRow } from "@/components/inbox/thread-row";
import { cn } from "@/lib/utils";
import type { InboxAgent, InboxMessage, InboxThread } from "@/lib/inbox/types";

type Quiet = { id: string; title: string; agentName: string; explanation: string };
type InboxPayload = {
  threads: InboxThread[];
  agents: InboxAgent[];
  quiet: Quiet[];
  attention: number;
  error?: string;
};

const tz = () => -new Date().getTimezoneOffset();

export function InboxView() {
  const [data, setData] = useState<InboxPayload | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [quietId, setQuietId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [tokens, setTokens] = useState<InboxAgent[]>([]);
  const [to, setTo] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [float, setFloat] = useState<{ x: number; y: number } | null>(null);
  const [info, setInfo] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  async function loadList() {
    const res = await fetch(`/api/inbox?tz=${tz()}`);
    const body = (await res.json()) as InboxPayload;
    if (!res.ok) {
      setError(body.error || "Agents are unavailable.");
      setData({ threads: [], agents: [], quiet: [], attention: 0 });
      return;
    }
    setError("");
    setData(body);
    if (!opened.current && body.threads.length) {
      opened.current = true;
      setSelected(body.threads.find((thread) => thread.unread > 0)?.id ?? body.threads[0].id);
    }
  }

  async function loadMessages(id: string) {
    const res = await fetch(`/api/inbox/threads/${id}`);
    if (!res.ok) return;
    const body = (await res.json()) as { messages: InboxMessage[] };
    setMessages(body.messages);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The initial inbox request only updates state after its fetch resolves.
    void loadList();
    const source = new EventSource("/api/inbox/stream");
    source.onmessage = (event) => {
      const next = JSON.parse(event.data) as { threads: InboxThread[] };
      setData((current) => (current ? { ...current, threads: next.threads } : current));
    };
    return () => source.close();
  }, []);

  useEffect(() => {
    if (!selected) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Thread messages update only after the selected thread request resolves.
    void loadMessages(selected);
  }, [selected, data?.threads.find((thread) => thread.id === selected)?.updatedAt, data?.threads.find((thread) => thread.id === selected)?.typing]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, selected]);

  const threads = data?.threads ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) => `${thread.title} ${thread.preview}`.toLowerCase().includes(q));
  }, [threads, query]);
  const pinned = [...threads.filter((thread) => thread.pinned)].sort((a, b) => a.pinOrder - b.pinOrder);
  const active = threads.find((thread) => thread.id === selected) ?? null;
  const quiet = (data?.quiet ?? []).filter((item) => query.trim() && `${item.title} ${item.agentName}`.toLowerCase().includes(query.trim().toLowerCase()));
  const replyMessage = messages.find((message) => message.id === replyTo) ?? null;
  const suggestions = useMemo(() => {
    if (!creating) return [];
    const q = to.trim().toLowerCase();
    const pool = (data?.agents ?? []).filter((agent) => !tokens.some((token) => token.id === agent.id));
    const matched = q ? pool.filter((agent) => agent.name.toLowerCase().includes(q)) : pool;
    return matched.slice(0, 8);
  }, [creating, to, tokens, data?.agents]);

  function addToken(agent: InboxAgent) {
    setTokens((current) => (current.some((item) => item.id === agent.id) ? current : [...current, agent]));
    setTo("");
    setHighlight(0);
  }

  function openCompose() {
    setCreating(true);
    setTokens([]);
    setTo("");
    setDraft("");
    setHighlight(0);
    setInfo(false);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!active || !draft.trim() || sending) return;
    setSending(true);
    const res = await fetch(`/api/inbox/threads/${active.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft, replyTo, tz: tz() }),
    });
    setSending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error || "Message was not sent.");
      return;
    }
    const body = (await res.json()) as { messages: InboxMessage[] };
    setMessages(body.messages);
    setDraft("");
    setReplyTo(null);
    void loadList();
  }

  async function act(signalId: string, action: string) {
    await fetch(`/api/inbox/signals/${signalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, tz: tz() }),
    });
    if (selected) void loadMessages(selected);
    void loadList();
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    const body = draft.trim();
    if (tokens.length === 0) {
      const prompt = to.trim();
      if (!prompt) return;
      setSending(true);
      const res = await fetch("/api/inbox/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      setSending(false);
      const created = (await res.json().catch(() => ({}))) as { threadId?: string; error?: string };
      if (!res.ok || !created.threadId) {
        setError(created.error || "Could not create that.");
        return;
      }
      setCreating(false);
      setTo("");
      setDraft("");
      setSelected(created.threadId);
      void loadList();
      return;
    }
    if (!body) return;
    setSending(true);
    let threadId = threads.find((thread) => thread.kind === "direct" && thread.agents[0]?.id === tokens[0]?.id)?.id;
    if (tokens.length > 1) {
      const res = await fetch("/api/inbox/pods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: tokens.map((agent) => agent.name).join(", "), agentIds: tokens.map((agent) => agent.id) }),
      });
      const created = (await res.json().catch(() => ({}))) as { threadId?: string; error?: string };
      if (!res.ok || !created.threadId) {
        setSending(false);
        setError(created.error || "Could not start that conversation.");
        return;
      }
      threadId = created.threadId;
    }
    if (!threadId) {
      setSending(false);
      setError("Could not start that conversation.");
      return;
    }
    const res = await fetch(`/api/inbox/threads/${threadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, tz: tz() }),
    });
    setSending(false);
    if (!res.ok) {
      const failed = (await res.json().catch(() => ({}))) as { error?: string };
      setError(failed.error || "Message was not sent.");
      return;
    }
    setCreating(false);
    setTokens([]);
    setTo("");
    setDraft("");
    setSelected(threadId);
    void loadList();
  }

  async function saveAgent(patch: { name: string; icon: string; color: string; instructions: string; spec: string }) {
    const agent = active?.agents[0];
    if (!agent) return;
    await fetch(`/api/inbox/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    void loadList();
  }

  async function togglePin(thread = active) {
    if (!thread) return;
    await fetch(`/api/inbox/threads/${thread.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !thread.pinned }),
    });
    void loadList();
  }

  async function mute(thread: InboxThread) {
    const agent = thread.agents[0];
    if (!agent) return;
    await fetch(`/api/inbox/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ muted: !agent.muted }),
    });
    void loadList();
  }

  async function talk(thread: InboxThread) {
    const agent = thread.agents[0];
    if (!agent) return;
    await fetch(`/api/inbox/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boost: Math.min(2, (agent.boost || 1) * 1.25) }),
    });
    void loadList();
  }

  async function remove(thread: InboxThread) {
    await fetch(`/api/inbox/threads/${thread.id}`, { method: "DELETE" });
    if (selected === thread.id) setSelected(null);
    setInfo(false);
    setRevealed(null);
    void loadList();
  }

  async function reorder(ids: string[]) {
    await fetch("/api/inbox/pins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    void loadList();
  }

  return (
    <>
      {float && <div className="grid h-full place-items-center text-sm text-muted-foreground">Agents is in its own window.</div>}
      <div
        className={cn(
          "flex min-h-0 flex-col",
          float ? "fixed z-[80] overflow-hidden rounded-2xl border border-white/50 shadow-[0_28px_80px_rgba(0,0,0,0.18)]" : "h-full",
        )}
        style={
          float
            ? {
                left: float.x,
                top: float.y,
                width: typeof window === "undefined" ? 960 : Math.min(960, window.innerWidth - 48),
                height: typeof window === "undefined" ? 680 : Math.min(680, window.innerHeight - 48),
                background: "rgba(255,255,255,0.62)",
                backdropFilter: "blur(28px) saturate(1.6)",
              }
            : undefined
        }
      >
        {float && (
          <div
            className="flex h-8 shrink-0 cursor-grab items-center justify-between px-3 text-xs text-[#3a3a3c] active:cursor-grabbing"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              drag.current = { dx: event.clientX - float.x, dy: event.clientY - float.y };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              setFloat({
                x: Math.max(8, event.clientX - drag.current.dx),
                y: Math.max(8, event.clientY - drag.current.dy),
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
          >
            <span>Agents</span>
            <button type="button" className="rounded-full px-2 py-0.5 hover:bg-black/5" onPointerDown={(event) => event.stopPropagation()} onClick={() => setFloat(null)}>
              Dock
            </button>
          </div>
        )}
        <div className="flex min-h-0 flex-1">
      <aside className={cn("flex w-[300px] shrink-0 flex-col border-r border-black/5 backdrop-blur-xl", float ? "bg-white/45" : "bg-[#f2f2f6]/80")}>
        <div className="flex items-center gap-2 px-3 pb-1 pt-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="h-7 min-w-0 flex-1 rounded-lg bg-[#e5e5ea] px-2.5 text-[13px] outline-none placeholder:text-[#8e8e93]"
          />
          <button
            type="button"
            aria-label="New message"
            onClick={() => (creating ? setCreating(false) : openCompose())}
            className="grid h-7 w-7 place-items-center rounded-full text-[#007aff] hover:bg-black/5"
          >
            <Pencil className="h-4 w-4" />
          </button>
          {!float && (
            <button
              type="button"
              aria-label="Open in a window"
              onClick={() => setFloat({ x: 248, y: 72 })}
              className="grid h-7 w-7 place-items-center rounded-full text-[#8e8e93] hover:bg-black/5"
            >
              <SquareArrowOutUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {pinned.length > 0 && !query && (
          <PinStrip
            threads={pinned}
            selected={selected}
            onSelect={(id) => { setSelected(id); setCreating(false); setQuietId(null); setInfo(false); }}
            onReorder={(ids) => void reorder(ids)}
          />
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && <p className="px-4 py-6 text-sm text-muted-foreground">{error}</p>}
          {filtered.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              selected={selected === thread.id}
              revealed={revealed === thread.id}
              onReveal={setRevealed}
              onSelect={() => { setSelected(thread.id); setCreating(false); setQuietId(null); setInfo(false); }}
              onPin={() => void togglePin(thread)}
              onMute={() => void mute(thread)}
              onTalk={() => void talk(thread)}
              onDelete={() => void remove(thread)}
              time={thread.previewAt ? clock(thread.previewAt) : ""}
            />
          ))}
          {quiet.map((item) => (
            <button key={item.id} type="button" onClick={() => { setQuietId(item.id); setSelected(null); }} className="flex w-full flex-col px-4 py-2 text-left hover:bg-background">
              <span className="text-sm">{item.title}</span>
              <span className="text-xs text-muted-foreground">{item.agentName}</span>
            </button>
          ))}
        </div>
      </aside>
      <section className={cn("flex min-w-0 flex-1 flex-col", float ? "bg-white/40" : "bg-white/75")}>
        {creating ? (
          <NewMessage
            tokens={tokens}
            to={to}
            suggestions={suggestions}
            highlight={highlight}
            draft={draft}
            sending={sending}
            onTo={(value) => {
              setTo(value);
              setHighlight(0);
            }}
            onHighlight={setHighlight}
            onAdd={addToken}
            onRemoveLast={() => setTokens((current) => current.slice(0, -1))}
            onDraft={setDraft}
            onSend={create}
          />
        ) : quietId && !active ? (
          <QuietNote item={(data?.quiet ?? []).find((item) => item.id === quietId) ?? null} />
        ) : active ? (
          <>
            <header className="flex items-center justify-center border-b border-black/5 px-4 py-2.5">
              <button type="button" className="truncate text-center text-[15px] font-semibold" onClick={() => setInfo(true)}>
                {active.title}
              </button>
            </header>
            <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-2">
                  <ThreadFaces thread={active} size={72} />
                  <p className="text-sm font-medium">{active.title}</p>
                </div>
              )}
              {messages.map((message, index) => (
                <Bubble
                  key={message.id}
                  message={message}
                  thread={active}
                  showDelivered={message.sender === "user" && index === messages.length - 1}
                  onAct={(action) => message.signalId && void act(message.signalId, action)}
                  onReply={() => setReplyTo(message.id)}
                />
              ))}
              {active.typing && (
                <div className="flex">
                  <span className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">···</span>
                </div>
              )}
            </div>
            <form onSubmit={send} className="px-4 py-3 pr-16">
              {replyMessage && (
                <div className="mb-2 flex items-center justify-between text-xs text-[#8e8e93]">
                  <span className="truncate">{replyMessage.body}</span>
                  <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">×</button>
                </div>
              )}
              <div className="flex items-end gap-2 rounded-[20px] bg-[#e9e9eb] px-3 py-1.5">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  rows={1}
                  placeholder="Message"
                  className="max-h-32 min-h-7 flex-1 resize-none bg-transparent py-1 text-[15px] outline-none placeholder:text-[#8e8e93]"
                />
                <button type="submit" disabled={!draft.trim() || sending} aria-label="Send" className="mb-0.5 grid h-7 w-7 place-items-center rounded-full bg-[#007aff] text-white disabled:opacity-40">
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="m-auto text-sm text-muted-foreground">{error || ""}</div>
        )}
      </section>
      {info && active && !creating && (
        <ContactSheet
          key={active.id}
          thread={active}
          onClose={() => setInfo(false)}
          onSave={(patch) => void saveAgent(patch)}
          onPin={() => void togglePin(active)}
          onMute={() => void mute(active)}
          onTalk={() => void talk(active)}
          onDelete={() => void remove(active)}
        />
      )}
        </div>
      </div>
    </>
  );
}

function NewMessage({
  tokens,
  to,
  suggestions,
  highlight,
  draft,
  sending,
  onTo,
  onHighlight,
  onAdd,
  onRemoveLast,
  onDraft,
  onSend,
}: {
  tokens: InboxAgent[];
  to: string;
  suggestions: InboxAgent[];
  highlight: number;
  draft: string;
  sending: boolean;
  onTo: (value: string) => void;
  onHighlight: (index: number) => void;
  onAdd: (agent: InboxAgent) => void;
  onRemoveLast: () => void;
  onDraft: (value: string) => void;
  onSend: (event: FormEvent) => void;
}) {
  const active = suggestions[Math.min(highlight, Math.max(suggestions.length - 1, 0))];
  return (
    <form onSubmit={onSend} className="flex min-h-0 flex-1 flex-col">
      <div className="relative border-b border-black/5 px-4 py-2">
        <div className="flex min-h-8 flex-wrap items-center gap-1.5">
          <span className="text-[15px] text-[#8e8e93]">To:</span>
          {tokens.map((agent) => (
            <span key={agent.id} className="inline-flex items-center gap-1 rounded-full bg-[#007aff]/12 py-0.5 pl-0.5 pr-2 text-[13px] text-[#007aff]">
              <AgentMark name={agent.name} icon={agent.icon} color={agent.color} size={18} />
              {agent.name}
            </span>
          ))}
          <input
            autoFocus
            value={to}
            onChange={(event) => onTo(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                onHighlight(Math.min(highlight + 1, suggestions.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                onHighlight(Math.max(highlight - 1, 0));
              } else if (event.key === "Enter" && active) {
                event.preventDefault();
                onAdd(active);
              } else if (event.key === "Backspace" && !to) {
                onRemoveLast();
              }
            }}
            placeholder={tokens.length ? "" : "Name"}
            className="min-w-[8rem] flex-1 bg-transparent py-1 text-[15px] outline-none"
          />
        </div>
        {(to.trim() || tokens.length === 0) && (suggestions.length > 0 || to.trim()) && (
          <ul className="absolute left-4 right-4 top-full z-10 mt-1 overflow-hidden rounded-xl bg-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl">
            {suggestions.map((agent, index) => (
              <li key={agent.id}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onAdd(agent)}
                  className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-[15px]", index === highlight && "bg-[#007aff]/10")}
                >
                  <AgentMark name={agent.name} icon={agent.icon} color={agent.color} size={28} />
                  {agent.name}
                </button>
              </li>
            ))}
            {tokens.length === 0 && to.trim() && suggestions.every((agent) => agent.name.toLowerCase() !== to.trim().toLowerCase()) && (
              <li>
                <button type="submit" className="w-full px-3 py-2 text-left text-[15px] text-[#007aff]">
                  New agent “{to.trim()}”
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
      <div className="flex-1" />
      <div className="px-4 py-3 pr-16">
        <div className="flex items-end gap-2 rounded-[20px] bg-[#e9e9eb] px-3 py-1.5">
          <textarea
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            placeholder="Message"
            className="max-h-32 min-h-7 flex-1 resize-none bg-transparent py-1 text-[15px] outline-none placeholder:text-[#8e8e93]"
          />
          <button type="submit" disabled={(!draft.trim() && tokens.length === 0) || sending} aria-label="Send" className="mb-0.5 grid h-7 w-7 place-items-center rounded-full bg-[#007aff] text-white disabled:opacity-40">
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </form>
  );
}

function Bubble({
  message,
  thread,
  showDelivered,
  onAct,
  onReply,
}: {
  message: InboxMessage;
  thread: InboxThread;
  showDelivered: boolean;
  onAct: (action: string) => void;
  onReply: () => void;
}) {
  if (message.type === "SYSTEM_STATUS") {
    return <p className="py-1 text-center text-[11px] text-muted-foreground">{message.body}</p>;
  }
  const mine = message.sender === "user";
  const agent = thread.agents.find((item) => item.id === message.agentId) ?? thread.agents[0];
  return (
    <div className={cn("flex", mine && "justify-end")}>
      <div className={cn("max-w-[78%]", mine && "items-end")}>
        {!mine && thread.kind === "pod" && <p className="mb-1 text-[11px] text-muted-foreground">{agent?.name}</p>}
        {message.type === "SIGNAL_CARD" || message.type === "REPORT" ? (
          <Card message={message} onAct={onAct} onReply={onReply} />
        ) : (
          <p className={cn("px-3.5 py-2 text-[15px] leading-5", mine ? "rounded-[18px] rounded-br-md bg-[#007aff] text-white" : "rounded-[18px] rounded-bl-md bg-[#e9e9eb] text-black")}>
            {message.body}
          </p>
        )}
        {showDelivered && <p className="mt-1 text-right text-[10px] text-muted-foreground">Delivered</p>}
      </div>
    </div>
  );
}

function Card({ message, onAct, onReply }: { message: InboxMessage; onAct: (action: string) => void; onReply: () => void }) {
  const payload = message.payload ?? {};
  const status = String(payload.status ?? "sent");
  const evidence = Array.isArray(payload.evidence) ? (payload.evidence as { title?: string; href?: string }[]) : [];
  const open = status === "sent";
  return (
    <article className="w-80 rounded-2xl border border-border bg-card p-3 text-sm">
      <h3 className="font-medium">{String(payload.title || message.body)}</h3>
      <Block label="I noticed" text={String(payload.summary ?? "")} />
      <Block label="I think" text={String(payload.hypothesis ?? "")} />
      <Block label="I'd do" text={String(payload.proposedAction ?? "")} />
      {payload.confidenceLabel ? <p className="mt-2 text-xs text-muted-foreground">{String(payload.confidenceLabel)}</p> : null}
      {evidence.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {evidence.map((item) => (
            <Link key={item.href || item.title} href={item.href || "/"} className="rounded-full border border-border px-2 py-0.5 text-[11px]">
              {item.title}
            </Link>
          ))}
        </div>
      )}
      {open && (
        <div className="mt-3 flex flex-wrap gap-1">
          <CardButton onClick={() => onAct("approve")}>Approve</CardButton>
          <CardButton onClick={onReply}>Edit</CardButton>
          <CardButton onClick={() => onAct("snooze")}>Snooze</CardButton>
          <CardButton onClick={() => onAct("dismiss")}>Not now</CardButton>
          <CardButton onClick={() => onAct("never")}>Never show this type</CardButton>
        </div>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-muted-foreground">Why am I seeing this?</summary>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{String(payload.explanation ?? "")}</p>
      </details>
    </article>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <p className="mt-2">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      {text}
    </p>
  );
}

function CardButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full border border-border px-2 py-1 text-[11px] hover:bg-muted">
      {children}
    </button>
  );
}

function QuietNote({ item }: { item: Quiet | null }) {
  if (!item) return null;
  return (
    <div className="m-auto max-w-md p-6">
      <h2 className="text-sm font-medium">{item.title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{item.agentName}</p>
      <p className="mt-3 text-sm leading-6">{item.explanation}</p>
    </div>
  );
}

function clock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date().toDateString() === date.toDateString();
  return today
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}
