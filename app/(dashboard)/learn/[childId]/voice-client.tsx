"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, MicOff } from "lucide-react";
import { SentinelMark } from "@/components/brand/sentinel-logo";
import { useRealtime, type VoiceTurn } from "./use-realtime";

export function VoiceClient({ childId, childName }: { childId: string; childName: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mentorName, setMentorName] = useState<string | null>(null);
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [thinking, setThinking] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const applyRef = useRef<((i: string) => void) | null>(null);

  /**
   * Runs the planner behind the live conversation. The mentor has already
   * answered by now — this steers the next turn.
   */
  const onChildUtterance = useCallback(
    async (childText: string, tutorText: string) => {
      setTurns((t) => [...t, { role: "CHILD" as const, text: childText }]);
      if (!sessionId) return;

      setThinking(true);
      try {
        const res = await fetch(`/api/sessions/${sessionId}/observe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ childText, tutorText }),
        });
        const body = await res.json();
        if (!body.ok) return;
        if (body.data.mentorName) setMentorName(body.data.mentorName);
        if (body.data.instructions) applyRef.current?.(body.data.instructions);
        setTurns((t) => {
          const copy = [...t];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === "CHILD") {
              copy[i] = {
                ...copy[i],
                action: body.data.action,
                target: body.data.target,
                observation: body.data.observation,
                reason: body.data.reason,
              };
              break;
            }
          }
          return copy;
        });
      } finally {
        setThinking(false);
      }
    },
    [sessionId]
  );

  const onTutorTurn = useCallback((tutorText: string) => {
    setTurns((t) => (t[t.length - 1]?.text === tutorText ? t : [...t, { role: "TUTOR", text: tutorText }]));
  }, []);

  const { state, error, liveChild, liveTutor, start, stop, applyInstructions } = useRealtime({
    sessionId,
    onChildUtterance,
    onTutorTurn,
    onMentorName: setMentorName,
  });

  useEffect(() => {
    applyRef.current = applyInstructions;
  }, [applyInstructions]);

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
              target: m.targetConcept ?? undefined,
              reason: m.rationale ?? undefined,
            }))
        );
      });
  }, [childId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, liveChild, liveTutor]);

  useEffect(() => () => stop(), [stop]);

  const live = state === "listening" || state === "speaking";
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
          <SentinelMark size={20} />
          <div className="min-w-0">
            <p className="truncate font-medium leading-tight">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {mentorName ? `talking with ${childName}` : `getting to know ${childName}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowReasoning((s) => !s)}
          className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          {showReasoning ? "Hide" : "Show"} reasoning
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto py-6">
        {turns.length === 0 && state === "idle" && (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <SentinelMark size={32} className="mx-auto opacity-40" />
            <p className="mt-4 font-medium">Tap the microphone to begin</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {displayName} will say hello first and lead the conversation.
              {childName} just talks — no button to hold.
            </p>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i}>
            {showReasoning && t.action && (
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
                  ? "ml-auto w-fit max-w-[75%] rounded-2xl rounded-br-sm bg-foreground px-4 py-2 text-background"
                  : "w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2"
              }
            >
              {t.text}
            </div>
          </div>
        ))}

        {liveTutor && (
          <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2 opacity-80">
            {liveTutor}
          </div>
        )}
        {liveChild && (
          <div className="ml-auto w-fit max-w-[75%] rounded-2xl rounded-br-sm bg-foreground/70 px-4 py-2 text-background">
            {liveChild}
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="flex flex-col items-center gap-3 pb-8">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          onClick={live ? stop : start}
          disabled={!sessionId || state === "connecting"}
          aria-label={live ? "Stop listening" : "Start talking"}
          className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 disabled:opacity-40 ${
            live ? "bg-destructive text-white" : "bg-foreground text-background hover:scale-105"
          }`}
        >
          {live && state === "listening" && (
            <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-30" />
          )}
          {live ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>

        <p className="h-5 text-sm text-muted-foreground" aria-live="polite">
          {state === "connecting"
            ? "Connecting…"
            : state === "listening"
              ? thinking
                ? "Listening · thinking about what you said"
                : "Listening — just talk"
              : state === "speaking"
                ? `${displayName} is speaking — you can interrupt`
                : state === "error"
                  ? "Something went wrong"
                  : "Microphone off"}
        </p>
      </div>
    </div>
  );
}
