"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { ElvaMark } from "@/components/brand/elva-logo";

interface Turn {
  role: "TUTOR" | "CHILD";
  text: string;
  action?: string;
  observation?: string;
  reason?: string;
  target?: string | null;
  sessionId?: string;
  createdAt?: string;
}

const MAX_COMPOSER_HEIGHT = 200;

export function SessionClient({ childId, childName }: { childId: string; childName: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mentorName, setMentorName] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [showThinking, setShowThinking] = useState(true);

  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId }),
    })
      .then((r) => r.json())
      .then((b) => {
        if (!b.ok) return;
        setSessionId(b.data.session.id);
        setMentorName(b.data.mentorName ?? null);
        setTurns(
          b.data.messages
            .filter((m: { role: string }) => m.role !== "SYSTEM")
            .map((m: Record<string, string | null>) => ({
              role: m.role as "TUTOR" | "CHILD",
              text: m.content ?? "",
              action: m.action ?? undefined,
              reason: m.rationale ?? undefined,
              target: m.targetConcept ?? undefined,
              sessionId: m.sessionId ?? undefined,
              createdAt: m.createdAt ?? undefined,
            }))
        );
      })
      .finally(() => setLoading(false));
  }, [childId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: loading ? "auto" : "smooth" });
  }, [turns, thinking, loading]);

  /** Grows the composer with its content, like a normal chat box. */
  const resize = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
  }, []);

  useEffect(resize, [input, resize]);

  async function send(text: string) {
    if (!sessionId || !text.trim() || busy) return;

    setBusy(true);
    setThinking(true);
    setInput("");
    setTurns((t) => [...t, { role: "CHILD", text }]);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";
      let started = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const evt = JSON.parse(part.slice(6));

          if (evt.type === "action") {
            if (evt.mentorName) setMentorName(evt.mentorName);
            setTurns((t) => [
              ...t,
              {
                role: "TUTOR",
                text: "",
                action: evt.action,
                observation: evt.observation,
                reason: evt.reason,
                target: evt.target,
              },
            ]);
            started = true;
          } else if (evt.type === "token" && started) {
            setThinking(false);
            setTurns((t) => {
              const copy = [...t];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, text: last.text + evt.text };
              return copy;
            });
          } else if (evt.type === "replace") {
            setTurns((t) => {
              const copy = [...t];
              copy[copy.length - 1] = { ...copy[copy.length - 1], text: evt.text };
              return copy;
            });
          }
        }
      }
    } finally {
      setThinking(false);
      setBusy(false);
      taRef.current?.focus();
    }
  }

  const displayName = mentorName ?? "Your mentor";

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col px-6">
      <div className="flex items-center justify-between gap-4 border-b py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Back to your children"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <ElvaMark size={20} />
          <div className="min-w-0">
            <p className="truncate font-medium leading-tight">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {mentorName ? `learning with ${childName}` : `getting to know ${childName}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowThinking((s) => !s)}
          className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          {showThinking ? "Hide" : "Show"} reasoning
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto py-6">
        {!loading && turns.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Say hello to get started.
          </div>
        )}

        {turns.map((t, i) => {
          const prev = turns[i - 1];
          const newSession =
            i > 0 && t.sessionId && prev?.sessionId && t.sessionId !== prev.sessionId;
          return (
            <div key={i}>
              {newSession && (
                <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  {t.createdAt
                    ? new Date(t.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    : "Earlier"}
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}

              {showThinking && t.action && (
                <div className="mb-1.5 rounded-md border-l-2 border-foreground/20 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-mono font-medium text-foreground/70">{t.action}</span>
                  {t.target ? <span className="font-mono"> → {t.target}</span> : null}
                  {t.observation ? <p className="mt-1">{t.observation}</p> : null}
                  {t.reason ? <p className="mt-1 italic">{t.reason}</p> : null}
                </div>
              )}

              <div
                className={
                  t.role === "CHILD"
                    ? "ml-auto w-fit max-w-[75%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-foreground px-4 py-2 text-background"
                    : "w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-muted px-4 py-2"
                }
              >
                {t.text || <ThinkingDots />}
              </div>
            </div>
          );
        })}

        {thinking && !turns.some((t) => t.role === "TUTOR" && t.text === "") && (
          <div className="w-fit rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
            <ThinkingDots />
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="pb-6">
        <div className="flex items-end gap-2 rounded-3xl border bg-background p-2 shadow-sm transition-shadow focus-within:shadow-md">
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={sessionId ? "Message…" : "Starting…"}
            disabled={!sessionId}
            className="max-h-[200px] flex-1 resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />
          <button
            onClick={() => send(input)}
            disabled={!sessionId || busy || !input.trim()}
            aria-label="Send message"
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-25"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Enter to send · Shift + Enter for a new line
        </p>
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="flex items-center gap-1" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "1s" }}
        />
      ))}
    </span>
  );
}
