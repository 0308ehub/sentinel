"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, MicOff, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { SentinelMark } from "@/components/brand/sentinel-logo";
import { useRealtime } from "./use-realtime";

interface MentorTurn {
  text: string;
  streaming?: boolean;
}

interface Reasoning {
  action?: string;
  target?: string | null;
  observation?: string;
  reason?: string;
}

export function VoiceClient({ childId, childName }: { childId: string; childName: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mentorName, setMentorName] = useState<string | null>(null);
  const [turns, setTurns] = useState<MentorTurn[]>([]);
  const [reasoning, setReasoning] = useState<Reasoning | null>(null);
  const [thinking, setThinking] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  /** True until the first load resolves, so we never flash an empty slate. */
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const applyRef = useRef<((i: string) => void) | null>(null);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId }),
      });
      const b = await res.json();
      if (!b.ok) return;
      setSessionId(b.data.session.id);
      setMentorName(b.data.mentorName ?? null);
      // Only the mentor's side is replayed. The child knows what they said, and
      // showing imperfect transcripts of their own speech back to them is noise.
      setTurns(
        b.data.messages
          .filter((m: { role: string }) => m.role === "TUTOR")
          .map((m: { content: string }) => ({ text: m.content }))
      );
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const onTutorStart = useCallback(() => {
    setTurns((t) => [...t, { text: "", streaming: true }]);
  }, []);

  const onTutorDelta = useCallback((chunk: string) => {
    setTurns((t) => {
      if (!t.length) return [{ text: chunk, streaming: true }];
      const copy = [...t];
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, text: last.text + chunk };
      return copy;
    });
  }, []);

  const onTutorTurn = useCallback((finalText: string) => {
    setTurns((t) => {
      if (!t.length) return finalText ? [{ text: finalText }] : t;
      const copy = [...t];
      copy[copy.length - 1] = { text: finalText || copy[copy.length - 1].text };
      return copy.filter((x) => x.text.trim().length > 0);
    });
  }, []);

  /** The planner runs behind the conversation and steers the next turn. */
  const onChildUtterance = useCallback(
    async (childText: string, tutorText: string) => {
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
        setReasoning({
          action: body.data.action,
          target: body.data.target,
          observation: body.data.observation,
          reason: body.data.reason,
        });
      } finally {
        setThinking(false);
      }
    },
    [sessionId]
  );

  const { state, error, liveChild, start, stop, applyInstructions } = useRealtime({
    sessionId,
    onChildUtterance,
    onTutorStart,
    onTutorDelta,
    onTutorTurn,
    onMentorName: setMentorName,
  });

  useEffect(() => {
    applyRef.current = applyInstructions;
  }, [applyInstructions]);

  // Only follow the conversation if the reader is already at the bottom, so
  // scrolling back to re-read is never yanked away.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || loading) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, liveChild, loading]);

  // On first paint land at the latest message without animating up from the top.
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (loading || didInitialScroll.current) return;
    didInitialScroll.current = true;
    endRef.current?.scrollIntoView({ behavior: "auto" });
  }, [loading]);

  useEffect(() => () => stop(), [stop]);

  async function clearHistory(scope: "conversation" | "everything") {
    setMenuOpen(false);
    const res = await fetch(`/api/children/${childId}/history`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, sessionId }),
    });
    const b = await res.json();
    if (!b.ok) {
      toast.error(b.error?.message ?? "Could not clear");
      return;
    }
    stop();
    setLoading(true);
    setTurns([]);
    setReasoning(null);
    setMentorName(null);
    await loadSession();
    toast.success(
      scope === "everything" ? "Reset — the mentor starts fresh" : "This conversation was cleared"
    );
  }

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
            {loading ? (
              <>
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="mt-1.5 h-3 w-36 animate-pulse rounded bg-muted" />
              </>
            ) : (
              <>
                <p className="truncate font-medium leading-tight">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {mentorName ? `talking with ${childName}` : `getting to know ${childName}`}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setShowReasoning((s) => !s)}
            className="rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {showReasoning ? "Hide" : "Show"} reasoning
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((m) => !m)}
              aria-label="More options"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border bg-background shadow-lg">
                  <button
                    onClick={() => clearHistory("conversation")}
                    className="block w-full px-4 py-3 text-left text-sm transition-colors hover:bg-muted"
                  >
                    Clear this conversation
                    <span className="block text-xs text-muted-foreground">
                      Only this one. Other conversations and everything the mentor
                      has learned are kept.
                    </span>
                  </button>
                  <button
                    onClick={() => clearHistory("everything")}
                    className="block w-full border-t px-4 py-3 text-left text-sm text-destructive transition-colors hover:bg-muted"
                  >
                    Reset everything
                    <span className="block text-xs text-muted-foreground">
                      Erases all conversations, memories, hypotheses, and the
                      mentor&apos;s name
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/*
        The reasoning lives in a fixed strip rather than inline with the messages.
        The planner finishes seconds after the turn it explains, so inserting it
        into the transcript pushed everything below it down — that was the jump.
      */}
      {showReasoning && (
        <div className="mt-3 min-h-[4.5rem] rounded-md border-l-2 border-foreground/20 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {reasoning ? (
            <>
              <span className="font-mono font-medium text-foreground/70">{reasoning.action}</span>
              {reasoning.target ? <span className="font-mono"> → {reasoning.target}</span> : null}
              {reasoning.observation ? <p className="mt-1">{reasoning.observation}</p> : null}
              {reasoning.reason ? <p className="mt-1 italic">{reasoning.reason}</p> : null}
            </>
          ) : (
            <span className="opacity-60">
              {thinking ? "Thinking…" : "The mentor's reasoning will appear here."}
            </span>
          )}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto py-6 pr-1">
        {loading && (
          <div className="space-y-4" aria-hidden>
            <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        )}

        {!loading && turns.length === 0 && state === "idle" && (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <SentinelMark size={32} className="mx-auto opacity-40" />
            <p className="mt-4 font-medium">Tap the microphone to begin</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {`${displayName} will say hello first and lead the conversation.`}
            </p>
          </div>
        )}

        {turns.map((t, i) => (
          <p key={i} className="max-w-[90%] text-[17px] leading-relaxed">
            {t.text}
          </p>
        ))}

        <div ref={endRef} />
      </div>

      <div className="flex flex-col items-center gap-3 pb-8">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Transient — shows the mic is hearing them, then gets out of the way. */}
        <p className="h-5 max-w-full truncate text-sm italic text-muted-foreground">
          {liveChild}
        </p>

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
              ? "Listening"
              : state === "speaking"
                ? "Speaking — you can interrupt"
                : state === "error"
                  ? "Something went wrong"
                  : "Microphone off"}
        </p>
      </div>
    </div>
  );
}
