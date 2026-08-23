"use client";

import { useCallback, useRef, useState } from "react";

export type VoiceState = "idle" | "connecting" | "listening" | "speaking" | "error";

export interface VoiceTurn {
  role: "TUTOR" | "CHILD";
  text: string;
  action?: string;
  target?: string | null;
  observation?: string;
  reason?: string;
}

interface UseRealtimeArgs {
  sessionId: string | null;
  onChildUtterance: (childText: string, tutorText: string) => void;
  /** A reply is starting — open an empty bubble to stream into. */
  onTutorStart: () => void;
  /** Append streamed text to the open bubble. */
  onTutorDelta: (chunk: string) => void;
  /** The reply is final. */
  onTutorTurn: (tutorText: string) => void;
  onMentorName: (name: string) => void;
}

const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime/calls";

/** How long a child may sit silent before the mentor gently re-engages. */
const IDLE_NUDGE_MS = 18_000;

/**
 * Transcript deltas arrive as the model GENERATES, which runs well ahead of the
 * audio the child actually hears. Revealing them directly makes text race the
 * voice, and leaves text on screen that was never spoken when a reply is cut off.
 * So we buffer the transcript and reveal it in step with playback instead.
 */
const REVEAL_TICK_MS = 50;
/**
 * Measured against the voice at speed 1.0. Erring slow is deliberate: text
 * trailing the audio slightly is unnoticeable, text running ahead spoils the
 * illusion and shows words before they are said.
 */
const CHARS_PER_SECOND = 11;
/**
 * Generation leads playback, so the first transcript delta arrives before any
 * sound. Wait for playback to actually start — but not forever, in case the
 * audio buffer events never arrive over WebRTC.
 */
const PLAYBACK_WAIT_MS = 700;
/**
 * Only catch up once the backlog is genuinely large. The model finishes composing
 * long before the voice finishes speaking, so a full buffer is the normal state —
 * treating it as "behind" made the text sprint ahead and finish early.
 */
const BACKLOG_CATCHUP_CHARS = 600;

/**
 * Transcribers still occasionally emit filler on non-speech audio. If we never saw
 * the VAD report speech, treat the transcript as phantom and drop it.
 */
function isPhantom(text: string, sawSpeech: boolean): boolean {
  if (!sawSpeech) return true;
  const t = text.trim().toLowerCase().replace(/[.!?]+$/, "");
  return t.length === 0 || ["you", "thank you", "thanks", "bye", "boom", "uh", "um"].includes(t);
}
/** Cap the nudges so a child who has wandered off isn't talked at forever. */
const MAX_CONSECUTIVE_NUDGES = 3;

export function useRealtime({
  sessionId,
  onChildUtterance,
  onTutorStart,
  onTutorDelta,
  onTutorTurn,
  onMentorName,
}: UseRealtimeArgs) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [liveChild, setLiveChild] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTutorRef = useRef("");
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Generated but not yet spoken — revealed as the audio plays. */
  const pendingRef = useRef("");
  /** What the child has actually heard so far this turn. */
  const spokenRef = useRef("");
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Guards against stopped and cleared both finalising the same turn. */
  const finalisedRef = useRef(true);
  /** True once audio playback has actually begun for the current response. */
  const playbackStartedRef = useRef(false);
  /** Safety net for the case where no playback events arrive at all. */
  const finaliseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The opening greeting must happen exactly once per connection. */
  const greetedRef = useRef(false);
  /** Prevents a second connection attempt racing the first. */
  const connectingRef = useRef(false);
  const nudgeCountRef = useRef(0);
  /** True while the mentor is generating — never stack a nudge on top of a reply. */
  const responseActiveRef = useRef(false);
  /** Did the VAD actually detect speech since the last transcript? */
  const sawSpeechRef = useRef(false);

  const revealStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Fractional characters carried between ticks so the rate is exact. */
  const revealCarryRef = useRef(0);

  const stopReveal = useCallback(() => {
    if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    revealTimerRef.current = null;
    if (revealStartTimerRef.current) clearTimeout(revealStartTimerRef.current);
    revealStartTimerRef.current = null;
    revealCarryRef.current = 0;
  }, []);

  /** Reveals buffered transcript at roughly the pace the voice is speaking. */
  const startReveal = useCallback(() => {
    if (revealTimerRef.current) return;
    if (revealStartTimerRef.current) {
      clearTimeout(revealStartTimerRef.current);
      revealStartTimerRef.current = null;
    }
    revealTimerRef.current = setInterval(() => {
      if (!pendingRef.current) return;
      // Carry the fraction between ticks. Rounding per tick silently floored to
      // one character, which at a 50ms tick is 20 chars/sec — nearly double the
      // intended rate, and why the text kept outrunning the voice.
      const perTick = (CHARS_PER_SECOND * REVEAL_TICK_MS) / 1000;
      const overflow = Math.max(0, pendingRef.current.length - BACKLOG_CATCHUP_CHARS);
      revealCarryRef.current += perTick + overflow / 400;
      const take = Math.floor(revealCarryRef.current);
      if (take < 1) return;
      revealCarryRef.current -= take;
      const chunk = pendingRef.current.slice(0, take);
      pendingRef.current = pendingRef.current.slice(take);
      spokenRef.current += chunk;
      onTutorDelta(chunk);
    }, REVEAL_TICK_MS);
  }, [onTutorDelta]);

  /**
   * Called when transcript text arrives. Holds briefly so the voice can get
   * going first; playback starting cancels the wait and begins immediately.
   */
  const scheduleReveal = useCallback(() => {
    if (revealTimerRef.current || revealStartTimerRef.current) return;
    revealStartTimerRef.current = setTimeout(() => {
      revealStartTimerRef.current = null;
      startReveal();
    }, PLAYBACK_WAIT_MS);
  }, [startReveal]);

  const clearIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  }, []);

  /**
   * Children don't fill silence — they wait, or drift. If nothing has happened for
   * a while, the mentor says something rather than leaving dead air.
   */
  const armIdleNudge = useCallback(() => {
    clearIdle();
    if (nudgeCountRef.current >= MAX_CONSECUTIVE_NUDGES) return;
    idleTimerRef.current = setTimeout(() => {
      const dc = dcRef.current;
      if (!dc || dc.readyState !== "open") return;
      // A reply is already on its way — nudging now produces the stray fragments.
      if (responseActiveRef.current) return;
      if (!playbackStartedRef.current && !finalisedRef.current) return;
      nudgeCountRef.current += 1;
      dc.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions:
              "The child has gone quiet. Don't ask what they want to do. Warmly offer " +
              "something specific and easy — a small question about something they like, " +
              "a fun fact, or an easier version of what you just asked. Keep it to one or " +
              "two short sentences.",
          },
        })
      );
    }, IDLE_NUDGE_MS);
  }, [clearIdle, stopReveal]);

  const stop = useCallback(() => {
    clearIdle();
    stopReveal();
    pendingRef.current = "";
    spokenRef.current = "";
    dcRef.current?.close();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    dcRef.current = null;
    pcRef.current = null;
    streamRef.current = null;
    setLiveChild("");
    nudgeCountRef.current = 0;
    responseActiveRef.current = false;
    sawSpeechRef.current = false;
    setState("idle");
  }, [clearIdle]);

  /** Revises the live session's instructions mid-conversation. */
  const applyInstructions = useCallback((instructions: string) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") return;
    dc.send(JSON.stringify({ type: "session.update", session: { type: "realtime", instructions } }));
  }, []);

  const start = useCallback(async () => {
    if (!sessionId || pcRef.current || connectingRef.current) return;
    connectingRef.current = true;
    greetedRef.current = false;
    setError(null);
    setState("connecting");

    try {
      const tokenRes = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const tokenBody = await tokenRes.json();
      if (!tokenBody.ok) throw new Error(tokenBody.error?.message ?? "Could not start voice session");
      const { clientSecret, model, mentorName } = tokenBody.data;
      if (mentorName) onMentorName(mentorName);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // The mentor's voice.
      pc.ontrack = (e) => {
        if (!audioRef.current) {
          const el = document.createElement("audio");
          el.autoplay = true;
          audioRef.current = el;
          document.body.appendChild(el);
        }
        audioRef.current.srcObject = e.streams[0];
      };

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      // The mentor opens the conversation. A child will not start it — but exactly
      // once: a re-opened channel or a second mount must not greet again.
      dc.onopen = () => {
        if (greetedRef.current) return;
        greetedRef.current = true;
        dc.send(JSON.stringify({ type: "response.create" }));
      };

      dc.onmessage = (e) => {
        const evt = JSON.parse(e.data);

        switch (evt.type) {
          case "response.created":
            responseActiveRef.current = true;
            clearIdle();
            pendingRef.current = "";
            spokenRef.current = "";
            finalisedRef.current = false;
            playbackStartedRef.current = false;
            if (finaliseTimerRef.current) clearTimeout(finaliseTimerRef.current);
            // Open the bubble now so text streams into a slot that already exists,
            // instead of appearing, vanishing, then reappearing committed.
            onTutorStart();
            break;

          // Playback lifecycle — the only reliable signal for what was HEARD.
          case "output_audio_buffer.started":
            playbackStartedRef.current = true;
            setState("speaking");
            startReveal();
            break;

          case "output_audio_buffer.stopped":
            // Finished naturally: everything generated was spoken.
            if (finaliseTimerRef.current) clearTimeout(finaliseTimerRef.current);
            if (!finalisedRef.current) {
              finalisedRef.current = true;
              stopReveal();
              if (pendingRef.current) {
                spokenRef.current += pendingRef.current;
                onTutorDelta(pendingRef.current);
                pendingRef.current = "";
              }
              lastTutorRef.current = spokenRef.current.trim();
              onTutorTurn(lastTutorRef.current);
              armIdleNudge();
            }
            setState("listening");
            break;

          case "output_audio_buffer.cleared":
            // Cut off. Anything not yet revealed was never spoken — drop it.
            if (finaliseTimerRef.current) clearTimeout(finaliseTimerRef.current);
            if (!finalisedRef.current) {
              finalisedRef.current = true;
              stopReveal();
              pendingRef.current = "";
              lastTutorRef.current = spokenRef.current.trim();
              onTutorTurn(lastTutorRef.current);
            }
            setState("listening");
            break;
          // Child speech, transcribed as they go.
          case "conversation.item.input_audio_transcription.delta":
            setLiveChild((t) => t + (evt.delta ?? ""));
            break;
          case "conversation.item.input_audio_transcription.completed": {
            const finalText = (evt.transcript ?? "").trim();
            const sawSpeech = sawSpeechRef.current;
            sawSpeechRef.current = false;
            setLiveChild("");
            if (isPhantom(finalText, sawSpeech)) break;
            nudgeCountRef.current = 0;
            onChildUtterance(finalText, lastTutorRef.current);
            break;
          }

          // Mentor speech.
          case "response.output_audio_transcript.delta":
            // Buffer, then reveal at speaking pace. Starting the loop here rather
            // than waiting on output_audio_buffer.started means text still streams
            // if that event never arrives — it just paces itself instead.
            pendingRef.current += evt.delta ?? "";
            setState("speaking");
            scheduleReveal();
            break;
          case "response.output_audio_transcript.done":
            // Generation finished, but playback has not. Do not render this —
            // output_audio_buffer.stopped/cleared decides what was actually said.
            break;
          case "response.done":
            // A reply stopped by the token ceiling ends mid-sentence, in text and
            // in audio. Surface it rather than leaving it to be guessed at.
            if (evt.response?.status === "incomplete") {
              const why = evt.response?.status_details?.reason ?? "unknown";
              console.warn(`[realtime] reply ended early: ${why}`);
              if (why === "max_output_tokens") {
                setError("That reply was cut short — the turn limit was reached.");
              }
            }
            // Generation finished — the voice is very likely still speaking.
            // Flushing here is what made the text teleport to the end mid-sentence.
            responseActiveRef.current = false;
            if (playbackStartedRef.current) {
              // Let output_audio_buffer.stopped/cleared close the turn.
              break;
            }
            // No playback events seen. Give them a moment, then finish anyway so a
            // silent or event-less response cannot strand the turn open.
            if (finaliseTimerRef.current) clearTimeout(finaliseTimerRef.current);
            finaliseTimerRef.current = setTimeout(() => {
              if (finalisedRef.current) return;
              finalisedRef.current = true;
              stopReveal();
              if (pendingRef.current) {
                spokenRef.current += pendingRef.current;
                onTutorDelta(pendingRef.current);
                pendingRef.current = "";
              }
              lastTutorRef.current = spokenRef.current.trim();
              onTutorTurn(lastTutorRef.current);
              armIdleNudge();
            }, 1500);
            break;

          // Barge-in: the child started talking over the mentor.
          case "input_audio_buffer.speech_started":
            // The mentor is no longer interrupted mid-reply, so its sentence keeps
            // playing and the text must keep pace with it. Only a genuine
            // output_audio_buffer.cleared truncates what we show.
            clearIdle();
            sawSpeechRef.current = true;
            nudgeCountRef.current = 0;
            setState("listening");
            break;

          case "error":
            setError(evt.error?.message ?? "Voice error");
            break;
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(`${OPENAI_REALTIME_URL}?model=${encodeURIComponent(model)}`, {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${clientSecret}`, "Content-Type": "application/sdp" },
      });
      if (!sdpRes.ok) throw new Error(`Voice connection failed (${sdpRes.status})`);

      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
      setState("listening");
      connectingRef.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start voice");
      setState("error");
      connectingRef.current = false;
      stop();
    }
  }, [
    sessionId,
    onChildUtterance,
    onTutorStart,
    onTutorDelta,
    onTutorTurn,
    onMentorName,
    stop,
    armIdleNudge,
    clearIdle,
    startReveal,
    scheduleReveal,
    stopReveal,
  ]);

  return { state, error, liveChild, start, stop, applyInstructions };
}
