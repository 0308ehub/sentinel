"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SentinelMark } from "@/components/brand/sentinel-logo";

interface Turn {
  role: "TUTOR" | "CHILD";
  text: string;
  action?: string;
  observation?: string;
  reason?: string;
  target?: string | null;
}

export function SessionClient({ childId, childName }: { childId: string; childName: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showThinking, setShowThinking] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId }),
    })
      .then((r) => r.json())
      .then((b) => {
        if (b.ok) setSessionId(b.data.id);
      });
  }, [childId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  async function send(text: string) {
    if (!sessionId || !text.trim() || busy) return;
    setBusy(true);
    setInput("");
    setTurns((t) => [...t, { role: "CHILD", text }]);

    const res = await fetch(`/api/sessions/${sessionId}/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const reader = res.body?.getReader();
    if (!reader) {
      setBusy(false);
      return;
    }
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
          setTurns((t) => {
            const copy = [...t];
            copy[copy.length - 1] = {
              ...copy[copy.length - 1],
              text: copy[copy.length - 1].text + evt.text,
            };
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
    setBusy(false);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SentinelMark size={22} />
          <div>
            <p className="font-medium leading-tight">Nova</p>
            <p className="text-xs text-muted-foreground">learning with {childName}</p>
          </div>
        </div>
        <button
          onClick={() => setShowThinking((s) => !s)}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          {showThinking ? "Hide" : "Show"} what Nova is thinking
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {turns.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Say hello to start. Try{" "}
            <button className="underline" onClick={() => send("hi")}>
              hi
            </button>{" "}
            — or jump in with{" "}
            <button className="underline" onClick={() => send("17 minus 9 is 10")}>
              &ldquo;17 minus 9 is 10&rdquo;
            </button>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i}>
            {showThinking && t.action && (
              <div className="mb-1 rounded-md border-l-2 border-foreground/20 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-mono font-medium text-foreground/70">{t.action}</span>
                {t.target ? <span className="font-mono"> → {t.target}</span> : null}
                {t.observation ? <p className="mt-1">{t.observation}</p> : null}
                {t.reason ? <p className="mt-1 italic">{t.reason}</p> : null}
              </div>
            )}
            <div
              className={
                t.role === "CHILD"
                  ? "ml-auto w-fit max-w-[75%] rounded-2xl rounded-br-sm bg-foreground px-4 py-2 text-background"
                  : "w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2"
              }
            >
              {t.text || <span className="opacity-50">…</span>}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-4 flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={sessionId ? "Type your answer…" : "Starting session…"}
          disabled={!sessionId || busy}
        />
        <Button type="submit" disabled={!sessionId || busy || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
