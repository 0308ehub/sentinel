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
  onMentorName: (name: string) => void;
}

const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime/calls";

export function useRealtime({ sessionId, onChildUtterance, onMentorName }: UseRealtimeArgs) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [liveChild, setLiveChild] = useState("");
  const [liveTutor, setLiveTutor] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTutorRef = useRef("");

  const stop = useCallback(() => {
    dcRef.current?.close();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    dcRef.current = null;
    pcRef.current = null;
    streamRef.current = null;
    setLiveChild("");
    setLiveTutor("");
    setState("idle");
  }, []);

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

      dc.onmessage = (e) => {
        const evt = JSON.parse(e.data);

        switch (evt.type) {
          // Child speech, transcribed as they go.
          case "conversation.item.input_audio_transcription.delta":
            setLiveChild((t) => t + (evt.delta ?? ""));
            break;
          case "conversation.item.input_audio_transcription.completed": {
            const finalText = (evt.transcript ?? "").trim();
            setLiveChild("");
            if (finalText) onChildUtterance(finalText, lastTutorRef.current);
            break;
          }

          // Mentor speech.
          case "response.output_audio_transcript.delta":
            setState("speaking");
            setLiveTutor((t) => t + (evt.delta ?? ""));
            break;
          case "response.output_audio_transcript.done":
            lastTutorRef.current = evt.transcript ?? "";
            break;
          case "response.done":
            setLiveTutor("");
            setState("listening");
            break;

          // Barge-in: the child started talking over the mentor.
          case "input_audio_buffer.speech_started":
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
  }, [sessionId, onChildUtterance, onMentorName, stop]);

  return { state, error, liveChild, liveTutor, start, stop, applyInstructions };
}
