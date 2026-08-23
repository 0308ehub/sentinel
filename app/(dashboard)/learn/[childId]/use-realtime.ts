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
  onTutorTurn: (tutorText: string) => void;
  onMentorName: (name: string) => void;
}

const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime/calls";

/** How long a child may sit silent before the mentor gently re-engages. */
const IDLE_NUDGE_MS = 18_000;

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
  onTutorTurn,
  onMentorName,
}: UseRealtimeArgs) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [liveChild, setLiveChild] = useState("");
  const [liveTutor, setLiveTutor] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTutorRef = useRef("");
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeCountRef = useRef(0);
  /** True while the mentor is generating — never stack a nudge on top of a reply. */
  const responseActiveRef = useRef(false);
  /** Did the VAD actually detect speech since the last transcript? */
  const sawSpeechRef = useRef(false);

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
  }, [clearIdle]);

  const stop = useCallback(() => {
    clearIdle();
    dcRef.current?.close();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    dcRef.current = null;
    pcRef.current = null;
    streamRef.current = null;
    setLiveChild("");
    setLiveTutor("");
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
    if (!sessionId || pcRef.current) return;
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

      // The mentor opens the conversation. A child will not start it.
      dc.onopen = () => {
        dc.send(JSON.stringify({ type: "response.create" }));
      };

      dc.onmessage = (e) => {
        const evt = JSON.parse(e.data);

        switch (evt.type) {
          case "response.created":
            responseActiveRef.current = true;
            clearIdle();
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
            setState("speaking");
            setLiveTutor((t) => t + (evt.delta ?? ""));
            break;
          case "response.output_audio_transcript.done": {
            const finalText = (evt.transcript ?? "").trim();
            lastTutorRef.current = finalText;
            // Commit it straight away. Waiting for the child's next utterance made
            // the text vanish the moment the mentor stopped talking.
            if (finalText) onTutorTurn(finalText);
            setLiveTutor("");
            break;
          }
          case "response.done":
            responseActiveRef.current = false;
            setLiveTutor("");
            setState("listening");
            // Start counting silence only once the mentor has finished talking.
            armIdleNudge();
            break;

          // Barge-in: the child started talking over the mentor.
          case "input_audio_buffer.speech_started":
            // The child is talking — cancel any pending nudge.
            clearIdle();
            sawSpeechRef.current = true;
            nudgeCountRef.current = 0;
            setState("listening");
            setLiveTutor("");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start voice");
      setState("error");
      stop();
    }
  }, [sessionId, onChildUtterance, onTutorTurn, onMentorName, stop, armIdleNudge, clearIdle]);

  return { state, error, liveChild, liveTutor, start, stop, applyInstructions };
}
